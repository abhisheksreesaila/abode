import { describe, expect, it } from "@effect/vitest";
import type { VoiceSessionInput } from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { TestClock } from "effect/testing";

import * as Voice from "./Voice.ts";
import { VoiceModelInstallError, VoiceModelStore } from "./VoiceModelStore.ts";
import { VoiceRecognizer, VoiceRecognizerError } from "./VoiceRecognizer.ts";

/** One chunk of two samples, both equal to `n`: the fake recognizer hears it as the word `cN`. */
const chunk = (n: number) => {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setInt16(0, n, true);
  view.setInt16(2, n, true);
  return bytes;
};

const LIMITS: Voice.VoiceLimits = {
  maxSessions: 2,
  maxSessionMs: 60_000,
  maxBytes: 64,
  maxChunkBytes: 16,
  maxPendingChunks: 4,
  idleSessionMs: 10_000,
  lateChunkWaitMs: 2_000,
  unloadIdleMs: 300_000,
};

interface FakeSession {
  readonly id: number;
  readonly words: string[];
  closed: boolean;
}

/** A recognizer that "hears" each chunk as one word, and a model store the test controls. */
function makeHarness(options: { installed?: boolean; failOpen?: boolean } = {}) {
  const sessions: FakeSession[] = [];
  const state = { loaded: false, unloads: 0, installed: options.installed ?? true };
  const downloadGate = Deferred.makeUnsafe<void>();
  let reportProgress: (fraction: number) => void = () => undefined;
  let downloadFails = false;

  const recognizer = VoiceRecognizer.of({
    unsupportedReason: Effect.succeed(null),
    loaded: Effect.sync(() => state.loaded),
    unload: Effect.sync(() => {
      state.loaded = false;
      state.unloads += 1;
    }),
    open: () =>
      options.failOpen
        ? Effect.fail(new VoiceRecognizerError({ reason: "load" }))
        : Effect.sync(() => {
            state.loaded = true;
            const fake: FakeSession = { id: sessions.length, words: [], closed: false };
            sessions.push(fake);
            return {
              accept: (samples: Float32Array) =>
                Effect.sync(() => {
                  fake.words.push(`c${Math.round((samples[0] ?? 0) * 32768)}`);
                }),
              finish: Effect.sync(() => fake.words.join(" ")),
              close: Effect.sync(() => {
                fake.closed = true;
              }),
            };
          }),
  });

  const store = VoiceModelStore.of({
    modelDir: "/models/fake",
    archiveBytes: 1000,
    installedBytes: Effect.sync(() => (state.installed ? 1200 : null)),
    install: (onProgress) => {
      reportProgress = onProgress;
      return Deferred.await(downloadGate).pipe(
        Effect.andThen(
          Effect.suspend(() =>
            downloadFails
              ? Effect.fail(new VoiceModelInstallError({ failure: "checksum" }))
              : Effect.sync(() => {
                  state.installed = true;
                }),
          ),
        ),
      );
    },
  });

  return {
    sessions,
    state,
    layer: Layer.merge(
      Layer.succeed(VoiceRecognizer, recognizer),
      Layer.succeed(VoiceModelStore, store),
    ),
    progress: (fraction: number) => reportProgress(fraction),
    finishDownload: (fail = false) => {
      downloadFails = fail;
      return Deferred.succeed(downloadGate, undefined);
    },
  };
}

type Harness = ReturnType<typeof makeHarness>;

/** Runs `body` against a Voice built over the harness. */
const withVoice = <A, E>(
  harness: Harness,
  body: (voice: Voice.Voice["Service"]) => Effect.Effect<A, E>,
  limits: Voice.VoiceLimits = LIMITS,
) =>
  Effect.gen(function* () {
    const voice = yield* Voice.Voice;
    return yield* body(voice);
  }).pipe(Effect.provide(Voice.layerWith(limits).pipe(Layer.provide(harness.layer))));

const OWNER = 1;
const advance = (ms: number) =>
  Effect.yieldNow.pipe(Effect.andThen(TestClock.adjust(Duration.millis(ms))));

const start = (voice: Voice.Voice["Service"], owner = OWNER) =>
  voice.handle({ op: "start" }, owner).pipe(
    Effect.map((result) => {
      if (result.op !== "started") throw new Error(`expected started, got ${result.op}`);
      return result.sessionId;
    }),
  );
const send = (
  voice: Voice.Voice["Service"],
  sessionId: string,
  seq: number,
  n: number,
  owner = OWNER,
) =>
  voice.handle({ op: "audio", sessionId, seq, pcm: chunk(n) } satisfies VoiceSessionInput, owner);
const finish = (voice: Voice.Voice["Service"], sessionId: string, chunks: number, owner = OWNER) =>
  voice.handle({ op: "finish", sessionId, chunks }, owner).pipe(
    Effect.map((result) => {
      if (result.op !== "text") throw new Error(`expected text, got ${result.op}`);
      return result.text;
    }),
  );

describe("Voice model state", () => {
  it.effect("reports a missing model, then download progress, then ready", () => {
    const h = makeHarness({ installed: false });
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        expect(yield* voice.status).toEqual({
          engine: "nemotron",
          model: "missing",
          loaded: false,
          sizeBytes: 1000,
        });

        const preparing = yield* voice.prepare;
        expect(preparing).toMatchObject({ model: "downloading", progress: 0 });
        h.progress(0.4);
        expect(yield* voice.status).toMatchObject({ model: "downloading", progress: 0.4 });

        yield* h.finishDownload();
        yield* advance(0);
        expect(yield* voice.status).toEqual({
          engine: "nemotron",
          model: "ready",
          loaded: false,
          sizeBytes: 1200,
        });
      }),
    );
  });

  it.effect("starting a second download while one runs does not start another", () => {
    const h = makeHarness({ installed: false });
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        yield* voice.prepare;
        h.progress(0.5);
        expect(yield* voice.prepare).toMatchObject({ model: "downloading", progress: 0.5 });
      }),
    );
  });

  it.effect("a failed download shows a fixed message and can be retried", () => {
    const h = makeHarness({ installed: false });
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        yield* voice.prepare;
        yield* h.finishDownload(true);
        yield* advance(0);
        expect(yield* voice.status).toMatchObject({
          model: "failed",
          message: "The downloaded speech model was damaged. Try again.",
        });
        expect(yield* voice.prepare).toMatchObject({ model: "downloading" });
      }),
    );
  });

  it.effect("refuses to start a dictation while the model is missing", () => {
    const h = makeHarness({ installed: false });
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const error = yield* start(voice).pipe(Effect.flip);
        expect(error).toMatchObject({ failure: "unavailable" });
        expect(h.state.loaded).toBe(false);
      }),
    );
  });

  it.effect("a model that fails to load is reported as failed so clients can fall back", () => {
    const h = makeHarness({ failOpen: true });
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const error = yield* start(voice).pipe(Effect.flip);
        expect(error).toMatchObject({ failure: "unavailable" });
        expect(yield* voice.status).toMatchObject({
          model: "failed",
          message: "The speech model could not be loaded.",
        });
      }),
    );
  });
});

describe("Voice sessions", () => {
  it.effect("feeds chunks in order even when they arrive out of order", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 2, 3);
        yield* send(voice, id, 0, 1);
        yield* send(voice, id, 1, 2);
        expect(yield* finish(voice, id, 3)).toBe("c1 c2 c3");
        expect(h.sessions[0]?.closed).toBe(true);
      }),
    );
  });

  it.effect("ignores a chunk that arrives twice", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 0, 1);
        yield* send(voice, id, 0, 1);
        yield* send(voice, id, 1, 2);
        expect(yield* finish(voice, id, 2)).toBe("c1 c2");
      }),
    );
  });

  it.effect("finish waits for a chunk still in flight", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 0, 1);
        const finishing = yield* finish(voice, id, 2).pipe(Effect.forkChild);
        yield* advance(500);
        yield* send(voice, id, 1, 2);
        expect(yield* Fiber.join(finishing)).toBe("c1 c2");
      }),
    );
  });

  it.effect("finish gives up when a chunk never arrives and frees the session", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 0, 1);
        const finishing = yield* finish(voice, id, 2).pipe(Effect.flip, Effect.forkChild);
        yield* advance(2_000);
        expect(yield* Fiber.join(finishing)).toMatchObject({ failure: "out_of_order" });
        expect(h.sessions[0]?.closed).toBe(true);
      }),
    );
  });

  it.effect("cancel closes the recognizer session and later audio is refused", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 0, 1);
        expect(yield* voice.handle({ op: "cancel", sessionId: id }, OWNER)).toEqual({ op: "ok" });
        expect(h.sessions[0]?.closed).toBe(true);
        const error = yield* send(voice, id, 1, 2).pipe(Effect.flip);
        expect(error).toMatchObject({ failure: "unknown_session" });
      }),
    );
  });

  it.effect("another connection cannot use or cancel a session it did not start", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice, 1);
        const error = yield* send(voice, id, 0, 1, 2).pipe(Effect.flip);
        expect(error).toMatchObject({ failure: "unknown_session" });
        yield* voice.handle({ op: "cancel", sessionId: id }, 2);
        expect(h.sessions[0]?.closed).toBe(false);
      }),
    );
  });
});

describe("Voice limits", () => {
  it.effect("allows two dictations at once and refuses a third until one ends", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const first = yield* start(voice);
        yield* start(voice);
        const busy = yield* start(voice).pipe(Effect.flip);
        expect(busy).toMatchObject({ failure: "busy" });
        yield* voice.handle({ op: "cancel", sessionId: first }, OWNER);
        yield* start(voice);
      }),
    );
  });

  it.effect("closes a session that sends more audio than allowed", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        // 4 bytes a chunk against a 64 byte limit: the 17th chunk is one too many.
        for (let seq = 0; seq < 16; seq += 1) yield* send(voice, id, seq, 1);
        const error = yield* send(voice, id, 16, 1).pipe(Effect.flip);
        expect(error).toMatchObject({ failure: "too_large" });
        expect(h.sessions[0]?.closed).toBe(true);
      }),
    );
  });

  it.effect("rejects a single chunk over the size limit and an odd-sized one", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        const big = yield* voice
          .handle({ op: "audio", sessionId: id, seq: 0, pcm: new Uint8Array(18) }, OWNER)
          .pipe(Effect.flip);
        expect(big).toMatchObject({ failure: "too_large" });

        const second = yield* start(voice);
        const odd = yield* voice
          .handle({ op: "audio", sessionId: second, seq: 0, pcm: new Uint8Array(3) }, OWNER)
          .pipe(Effect.flip);
        expect(odd).toMatchObject({ failure: "too_large" });
      }),
    );
  });

  it.effect("refuses a chunk too far ahead of the missing one", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 3, 1);
        const error = yield* send(voice, id, 4, 1).pipe(Effect.flip);
        expect(error).toMatchObject({ failure: "out_of_order" });
      }),
    );
  });

  it.effect("stops a dictation that runs past the maximum length", () => {
    const h = makeHarness();
    return withVoice(
      h,
      (voice) =>
        Effect.gen(function* () {
          const id = yield* start(voice);
          yield* send(voice, id, 0, 1);
          // Keep sending so the idle timer never fires; only the total length is over.
          for (let step = 1; step <= 5; step += 1) {
            yield* advance(9_000);
            yield* send(voice, id, step, 1);
          }
          expect(h.sessions[0]?.closed).toBe(false);
          yield* advance(9_000);
          // 54 s in: past the 50 s limit, so the session was closed on its own.
          expect(h.sessions[0]?.closed).toBe(true);
          const error = yield* send(voice, id, 6, 1).pipe(Effect.flip);
          expect(error).toMatchObject({ failure: "unknown_session" });
        }),
      { ...LIMITS, maxSessionMs: 50_000, maxBytes: 4_000 },
    );
  });

  it.effect("cleans up a session whose client went away", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const first = yield* start(voice);
        yield* start(voice);
        yield* send(voice, first, 0, 1);
        yield* advance(9_999);
        expect(h.sessions.map((session) => session.closed)).toEqual([false, false]);
        yield* advance(1);
        expect(h.sessions.map((session) => session.closed)).toEqual([true, true]);
        // Both slots are free again.
        yield* start(voice);
        yield* start(voice);
      }),
    );
  });

  it.effect("sending audio keeps a session from being treated as abandoned", () => {
    const h = makeHarness();
    return withVoice(
      h,
      (voice) =>
        Effect.gen(function* () {
          const id = yield* start(voice);
          for (let seq = 0; seq < 5; seq += 1) {
            yield* advance(8_000);
            yield* send(voice, id, seq, 1);
          }
          expect(h.sessions[0]?.closed).toBe(false);
          expect(yield* finish(voice, id, 5)).toBe("c1 c1 c1 c1 c1");
        }),
      { ...LIMITS, maxSessionMs: 600_000, maxBytes: 1_000 },
    );
  });
});

describe("Voice model unloading", () => {
  it.effect("unloads the model after the idle period following the last dictation", () => {
    const h = makeHarness();
    return withVoice(h, (voice) =>
      Effect.gen(function* () {
        const id = yield* start(voice);
        yield* send(voice, id, 0, 1);
        yield* finish(voice, id, 1);
        expect(h.state.loaded).toBe(true);

        yield* advance(299_999);
        expect(h.state.loaded).toBe(true);
        yield* advance(1);
        expect(h.state.loaded).toBe(false);
        expect(h.state.unloads).toBe(1);
        expect(yield* voice.status).toMatchObject({ model: "ready", loaded: false });
      }),
    );
  });

  it.effect("a new dictation restarts the idle countdown instead of being unloaded under", () => {
    const h = makeHarness();
    return withVoice(
      h,
      (voice) =>
        Effect.gen(function* () {
          const first = yield* start(voice);
          yield* finish(voice, first, 0);
          yield* advance(200_000);

          const second = yield* start(voice);
          yield* advance(200_000);
          expect(h.state.loaded).toBe(true);
          yield* send(voice, second, 0, 1);
          yield* advance(0);
          yield* finish(voice, second, 1);

          yield* advance(299_999);
          expect(h.state.loaded).toBe(true);
          yield* advance(1);
          expect(h.state.unloads).toBe(1);
        }),
      { ...LIMITS, idleSessionMs: 1_000_000, maxSessionMs: 1_000_000 },
    );
  });
});
