/**
 * Voice - dictation on the host. A client opens a session, streams 16 kHz PCM chunks into it
 * while the user talks and gets the final text back when they stop. The speech model itself
 * sits behind `VoiceRecognizer` (a worker thread in production) and its files behind
 * `VoiceModelStore`; this module owns what is left: the model's download state, the sessions
 * and every bound on them.
 *
 * Bounds (see `VoiceLimits`): concurrent sessions, session length, bytes, chunk size, how far
 * out of order a chunk may arrive, and how long a session may sit silent. A client that
 * disconnects stops sending, so the silence limit is also its cleanup. Sessions belong to the
 * connection that started them. The model is loaded by the first session and unloaded after a
 * few idle minutes.
 *
 * @module abode/voice/Voice
 */
import {
  VoiceError,
  type VoiceFailure,
  type VoiceSessionInput,
  type VoiceSessionResult,
  type VoiceStatus,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Semaphore from "effect/Semaphore";

import { VoiceModelStore } from "./VoiceModelStore.ts";
import { VoiceRecognizer, type RecognizerSession } from "./VoiceRecognizer.ts";

export interface VoiceLimits {
  readonly maxSessions: number;
  /** Longest dictation, like VS Code's 20 minutes. */
  readonly maxSessionMs: number;
  /** Most audio bytes one session may send. */
  readonly maxBytes: number;
  readonly maxChunkBytes: number;
  /** How many chunks ahead of the next expected one are held back waiting for the gap. */
  readonly maxPendingChunks: number;
  /** A session with no audio and no finish for this long is closed. */
  readonly idleSessionMs: number;
  /** How long `finish` waits for chunks still in flight. */
  readonly lateChunkWaitMs: number;
  /** The model is freed this long after the last session ends. */
  readonly unloadIdleMs: number;
}

const PCM_BYTES_PER_SECOND = 16_000 * 2;

export const DEFAULT_VOICE_LIMITS: VoiceLimits = {
  maxSessions: 2,
  maxSessionMs: 20 * 60_000,
  maxBytes: 21 * 60 * PCM_BYTES_PER_SECOND,
  maxChunkBytes: 5 * PCM_BYTES_PER_SECOND,
  maxPendingChunks: 64,
  idleSessionMs: 15_000,
  lateChunkWaitMs: 5_000,
  unloadIdleMs: 5 * 60_000,
};

export const voiceError = (failure: VoiceFailure, message: string, cause?: unknown) =>
  new VoiceError({ failure, message, ...(cause === undefined ? {} : { cause }) });

const int16ToFloat = (pcm: Uint8Array): Float32Array => {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const samples = new Float32Array(pcm.byteLength / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
};

type ModelProblem =
  | { readonly kind: "downloading"; progress: number }
  | { readonly kind: "failed"; readonly message: string };

interface Session {
  readonly id: string;
  readonly owner: number;
  readonly recognizer: RecognizerSession;
  readonly startedAt: number;
  readonly lock: Semaphore.Semaphore;
  readonly pending: Map<number, Uint8Array>;
  readonly complete: Deferred.Deferred<void>;
  watchdog: Fiber.Fiber<void> | undefined;
  lastActivityAt: number;
  bytes: number;
  nextSeq: number;
  expectedChunks: number | null;
}

export class Voice extends Context.Service<
  Voice,
  {
    readonly status: Effect.Effect<VoiceStatus>;
    /** Starts the model download when it is missing; returns the status either way. */
    readonly prepare: Effect.Effect<VoiceStatus>;
    /** One call per wire request; `owner` is the connection, which alone may use its sessions. */
    readonly handle: (
      input: VoiceSessionInput,
      owner: number,
    ) => Effect.Effect<VoiceSessionResult, VoiceError>;
  }
>()("t3/abode/voice/Voice") {}

const makeWith = (limits: VoiceLimits) =>
  Effect.gen(function* () {
    const recognizer = yield* VoiceRecognizer;
    const store = yield* VoiceModelStore;
    const scope = yield* Effect.scope;

    const sessions = new Map<string, Session>();
    let opening = 0;
    let problem: ModelProblem | null = null;
    let unloadTimer: Fiber.Fiber<void> | undefined;
    let nextId = 1;

    const status: Effect.Effect<VoiceStatus> = Effect.gen(function* () {
      const unsupported = yield* recognizer.unsupportedReason;
      const loaded = yield* recognizer.loaded;
      if (unsupported !== null) {
        return { engine: "nemotron", model: "unsupported", loaded, message: unsupported } as const;
      }
      if (problem?.kind === "downloading") {
        return {
          engine: "nemotron",
          model: "downloading",
          progress: problem.progress,
          sizeBytes: store.archiveBytes,
          loaded,
        } as const;
      }
      if (problem?.kind === "failed") {
        return {
          engine: "nemotron",
          model: "failed",
          loaded,
          sizeBytes: store.archiveBytes,
          message: problem.message,
        } as const;
      }
      const installed = yield* store.installedBytes;
      return installed === null
        ? ({
            engine: "nemotron",
            model: "missing",
            loaded,
            sizeBytes: store.archiveBytes,
          } as const)
        : ({ engine: "nemotron", model: "ready", loaded, sizeBytes: installed } as const);
    });

    const prepare: Effect.Effect<VoiceStatus> = Effect.gen(function* () {
      const unsupported = yield* recognizer.unsupportedReason;
      if (unsupported === null && problem?.kind !== "downloading") {
        if ((yield* store.installedBytes) !== null) {
          // Files are there; a failed load is forgotten so the next dictation retries it.
          problem = null;
        } else {
          const download = { kind: "downloading", progress: 0 } as {
            kind: "downloading";
            progress: number;
          };
          problem = download;
          yield* store
            .install((fraction) => {
              download.progress = fraction;
            })
            .pipe(
              Effect.matchEffect({
                onSuccess: () =>
                  Effect.sync(() => {
                    problem = null;
                  }),
                onFailure: (error) =>
                  Effect.sync(() => {
                    problem = { kind: "failed", message: error.message };
                  }),
              }),
              Effect.forkIn(scope),
            );
        }
      }
      return yield* status;
    });

    // ---- sessions ---------------------------------------------------------------------------

    const scheduleUnload = Effect.gen(function* () {
      if (unloadTimer) yield* Fiber.interrupt(unloadTimer);
      unloadTimer = yield* Effect.sleep(limits.unloadIdleMs).pipe(
        Effect.andThen(
          Effect.suspend(() =>
            sessions.size === 0 && opening === 0 ? recognizer.unload : Effect.void,
          ),
        ),
        Effect.forkIn(scope),
      );
    });

    const closeSession = (session: Session, options?: { readonly fromWatchdog?: boolean }) =>
      Effect.gen(function* () {
        if (sessions.get(session.id) !== session) return;
        sessions.delete(session.id);
        yield* session.recognizer.close;
        if (sessions.size === 0 && opening === 0) yield* scheduleUnload;
        if (!options?.fromWatchdog && session.watchdog) yield* Fiber.interrupt(session.watchdog);
      });

    /** Closes the session once it has been silent, or lived, too long. */
    const watch = (session: Session): Effect.Effect<void> =>
      Effect.gen(function* () {
        while (true) {
          const now = yield* Clock.currentTimeMillis;
          const idleLeft = session.lastActivityAt + limits.idleSessionMs - now;
          const lifeLeft = session.startedAt + limits.maxSessionMs - now;
          if (idleLeft <= 0 || lifeLeft <= 0) {
            yield* closeSession(session, { fromWatchdog: true });
            return;
          }
          yield* Effect.sleep(Math.min(idleLeft, lifeLeft));
        }
      });

    const requireSession = (owner: number, sessionId: string) => {
      const session = sessions.get(sessionId);
      return session && session.owner === owner
        ? Effect.succeed(session)
        : Effect.fail(voiceError("unknown_session", "This dictation is no longer running."));
    };

    // Uninterruptible: an interrupt between opening the recognizer stream and registering the
    // session would leave the stream open with nobody to close it.
    const start = (owner: number) =>
      Effect.uninterruptible(
        Effect.gen(function* () {
          const current = yield* status;
          if (current.model !== "ready") {
            return yield* voiceError(
              "unavailable",
              "The speech model is not ready on this computer.",
            );
          }
          if (sessions.size + opening >= limits.maxSessions) {
            return yield* voiceError("busy", "Too many dictations are running on this computer.");
          }
          opening += 1;
          if (unloadTimer) yield* Fiber.interrupt(unloadTimer);
          const opened = yield* recognizer.open(store.modelDir).pipe(
            Effect.mapError((error) => {
              problem = { kind: "failed", message: error.message };
              return voiceError("unavailable", error.message, error);
            }),
            Effect.ensuring(
              Effect.sync(() => {
                opening -= 1;
              }),
            ),
            Effect.onError(() =>
              sessions.size === 0 && opening === 0 ? scheduleUnload : Effect.void,
            ),
          );
          const now = yield* Clock.currentTimeMillis;
          const session: Session = {
            id: `v${nextId++}`,
            owner,
            recognizer: opened,
            startedAt: now,
            lastActivityAt: now,
            lock: yield* Semaphore.make(1),
            pending: new Map(),
            complete: yield* Deferred.make<void>(),
            watchdog: undefined,
            bytes: 0,
            nextSeq: 0,
            expectedChunks: null,
          };
          sessions.set(session.id, session);
          session.watchdog = yield* Effect.forkIn(watch(session), scope);
          return session.id;
        }),
      );

    /** Feeds every chunk that is next in line to the recognizer. */
    const drain = (session: Session) =>
      session.lock.withPermits(1)(
        Effect.gen(function* () {
          let chunk = session.pending.get(session.nextSeq);
          while (chunk !== undefined) {
            session.pending.delete(session.nextSeq);
            session.nextSeq += 1;
            yield* session.recognizer.accept(int16ToFloat(chunk));
            chunk = session.pending.get(session.nextSeq);
          }
          if (session.expectedChunks !== null && session.nextSeq >= session.expectedChunks) {
            yield* Deferred.succeed(session.complete, undefined);
          }
        }),
      );

    const fail = (session: Session, failure: VoiceFailure, message: string) =>
      closeSession(session).pipe(Effect.andThen(Effect.fail(voiceError(failure, message))));

    const audio = (owner: number, input: Extract<VoiceSessionInput, { op: "audio" }>) =>
      Effect.gen(function* () {
        const session = yield* requireSession(owner, input.sessionId);
        const size = input.pcm.byteLength;
        if (size === 0 || size % 2 !== 0 || size > limits.maxChunkBytes || input.seq < 0) {
          return yield* fail(session, "too_large", "That audio chunk is not valid.");
        }
        const now = yield* Clock.currentTimeMillis;
        if (now - session.startedAt > limits.maxSessionMs) {
          return yield* fail(session, "too_long", "That dictation ran too long.");
        }
        if (session.bytes + size > limits.maxBytes) {
          return yield* fail(session, "too_large", "That dictation holds too much audio.");
        }
        if (input.seq >= session.nextSeq + limits.maxPendingChunks) {
          return yield* fail(session, "out_of_order", "Audio arrived too far out of order.");
        }
        session.lastActivityAt = now;
        // A chunk already fed is a duplicate: acknowledge and drop it.
        if (input.seq < session.nextSeq || session.pending.has(input.seq)) return;
        session.bytes += size;
        session.pending.set(input.seq, input.pcm);
        yield* drain(session).pipe(Effect.catch((error) => fail(session, "failed", error.message)));
      });

    const finish = (owner: number, input: Extract<VoiceSessionInput, { op: "finish" }>) =>
      Effect.gen(function* () {
        const session = yield* requireSession(owner, input.sessionId);
        session.expectedChunks = input.chunks;
        session.lastActivityAt = yield* Clock.currentTimeMillis;
        yield* drain(session).pipe(Effect.catch((error) => fail(session, "failed", error.message)));
        const arrived = yield* Deferred.await(session.complete).pipe(
          Effect.timeoutOption(limits.lateChunkWaitMs),
        );
        if (Option.isNone(arrived)) {
          return yield* fail(session, "out_of_order", "Some audio never arrived.");
        }
        return yield* session.recognizer.finish.pipe(
          Effect.mapError((error) => voiceError("failed", error.message, error)),
          Effect.ensuring(closeSession(session)),
        );
      });

    const handle = (input: VoiceSessionInput, owner: number) => {
      switch (input.op) {
        case "status":
          return status.pipe(
            Effect.map((value): VoiceSessionResult => ({ op: "status", status: value })),
          );
        case "prepare":
          return prepare.pipe(
            Effect.map((value): VoiceSessionResult => ({ op: "status", status: value })),
          );
        case "start":
          return start(owner).pipe(
            Effect.map((sessionId): VoiceSessionResult => ({ op: "started", sessionId })),
          );
        case "audio":
          return audio(owner, input).pipe(Effect.as<VoiceSessionResult>({ op: "ok" }));
        case "finish":
          return finish(owner, input).pipe(
            Effect.map((text): VoiceSessionResult => ({ op: "text", text })),
          );
        case "cancel": {
          const session = sessions.get(input.sessionId);
          return (session && session.owner === owner ? closeSession(session) : Effect.void).pipe(
            Effect.as<VoiceSessionResult>({ op: "ok" }),
          );
        }
      }
    };

    return Voice.of({ status, prepare, handle });
  });

export const layerWith = (limits: VoiceLimits) => Layer.effect(Voice, makeWith(limits));

export const layer = layerWith(DEFAULT_VOICE_LIMITS);
