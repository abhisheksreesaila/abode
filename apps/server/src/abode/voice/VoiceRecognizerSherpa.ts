// @effect-diagnostics nodeBuiltinImport:off - worker_threads is not in the Effect platform layer.
/**
 * Live VoiceRecognizer: sherpa-onnx (Nemotron streaming) in a worker thread, four threads.
 * The worker starts on the first dictation and is terminated by `unload`; while it is alive
 * its model stays in memory (about 1.4 GB), so `Voice` unloads it after a few idle minutes.
 *
 * @module abode/voice/VoiceRecognizerSherpa
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeURL from "node:url";
import * as NodeWorkerThreads from "node:worker_threads";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HostProcess from "@t3tools/shared/HostProcess";

import {
  VoiceRecognizer,
  VoiceRecognizerError,
  type RecognizerSession,
} from "./VoiceRecognizer.ts";
import type { FromWorker, ToWorker } from "./workerProtocol.ts";

/** Four threads: more is slower in sherpa (docs/research/voice-nemotron.md). */
const DECODE_THREADS = 4;

/** Sherpa publishes prebuilt addons for these (`sherpa-onnx-<platform>-<arch>`). */
const SUPPORTED_PLATFORMS = new Set([
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "win32-x64",
  "win32-ia32",
]);

/** The bundle emits `voiceWorker.mjs` beside the entry; from source it is a sibling `.ts`. */
function findWorkerFile(): string | null {
  for (const name of ["./voiceWorker.mjs", "./voiceWorker.ts"]) {
    const file = NodeURL.fileURLToPath(new URL(name, import.meta.url));
    if (NodeFS.existsSync(file)) return file;
  }
  return null;
}

function computeUnsupportedReason(target: string): string | null {
  if (!SUPPORTED_PLATFORMS.has(target)) {
    return `Speech recognition is not available on ${target}.`;
  }
  if (findWorkerFile() === null) return "This build of the server doesn't include speech support.";
  try {
    NodeModule.createRequire(import.meta.url).resolve("sherpa-onnx-node");
  } catch {
    return "The speech engine (sherpa-onnx) is not installed.";
  }
  return null;
}

interface PendingText {
  readonly resolve: (text: string) => void;
  readonly reject: (error: Error) => void;
}

/** A started worker and the bookkeeping for the dictations running on it. */
interface Engine {
  readonly worker: NodeWorkerThreads.Worker;
  readonly modelDir: string;
  readonly ready: Promise<void>;
  readonly pending: Map<number, PendingText>;
  alive: boolean;
}

function startEngine(workerFile: string, modelDir: string): Engine {
  const worker = new NodeWorkerThreads.Worker(workerFile, {
    workerData: { modelDir, threads: DECODE_THREADS },
  });
  const pending = new Map<number, PendingText>();
  let markReady: () => void = () => undefined;
  let failLoad: (error: Error) => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    failLoad = reject;
  });
  // A rejection nobody awaits (the worker died before any dictation) must not be unhandled.
  ready.catch(() => undefined);
  const engine: Engine = { worker, modelDir, ready, pending, alive: true };

  const die = (error: Error) => {
    engine.alive = false;
    failLoad(error);
    for (const waiting of pending.values()) waiting.reject(error);
    pending.clear();
  };
  worker.on("message", (message: FromWorker) => {
    if (message.type === "ready") markReady();
    else if (message.type === "load-failed") die(new Error(message.message));
    else if (message.type === "text") {
      pending.get(message.id)?.resolve(message.text);
      pending.delete(message.id);
    } else {
      pending.get(message.id)?.reject(new Error(message.message));
      pending.delete(message.id);
    }
  });
  worker.on("error", die);
  worker.on("exit", () => die(new Error("The speech worker stopped.")));
  return engine;
}

const make = Effect.gen(function* () {
  const platform = yield* HostProcess.Platform;
  const architecture = yield* HostProcess.Architecture;
  const unsupportedReason = computeUnsupportedReason(`${platform}-${architecture}`);
  let engine: Engine | null = null;
  let nextSessionId = 1;

  const ensureEngine = (modelDir: string): Promise<Engine> => {
    if (engine && (!engine.alive || engine.modelDir !== modelDir)) {
      void engine.worker.terminate();
      engine = null;
    }
    const workerFile = findWorkerFile();
    if (!engine && workerFile) engine = startEngine(workerFile, modelDir);
    const started = engine;
    if (!started) return Promise.reject(new Error("voice worker file is missing"));
    return started.ready.then(() => started);
  };

  const post = (target: Engine, message: ToWorker, transfer?: ArrayBuffer[]) => {
    if (!target.alive) throw new Error("The speech worker stopped.");
    target.worker.postMessage(message, transfer ?? []);
  };

  const open = (modelDir: string) =>
    Effect.tryPromise({
      try: async (): Promise<RecognizerSession> => {
        if (unsupportedReason) throw new Error(unsupportedReason);
        const running = await ensureEngine(modelDir);
        const id = nextSessionId++;
        post(running, { type: "open", id });
        return {
          accept: (samples) =>
            Effect.try({
              try: () => {
                // The caller hands over a fresh array, so its buffer can move to the worker.
                post(running, { type: "audio", id, samples }, [samples.buffer as ArrayBuffer]);
              },
              catch: (cause) => new VoiceRecognizerError({ reason: "decode", cause }),
            }),
          finish: Effect.tryPromise({
            try: () =>
              new Promise<string>((resolve, reject) => {
                running.pending.set(id, { resolve, reject });
                try {
                  post(running, { type: "finish", id });
                } catch (error) {
                  running.pending.delete(id);
                  reject(error instanceof Error ? error : new Error(String(error)));
                }
              }),
            catch: (cause) => new VoiceRecognizerError({ reason: "decode", cause }),
          }),
          close: Effect.sync(() => {
            running.pending.delete(id);
            if (running.alive) post(running, { type: "close", id });
          }),
        };
      },
      catch: (cause) =>
        new VoiceRecognizerError({ reason: unsupportedReason ? "unsupported" : "load", cause }),
    });

  const unload = Effect.promise(async () => {
    const stopped = engine;
    engine = null;
    if (stopped) await stopped.worker.terminate();
  });

  // The worker keeps the process alive, so it goes down with the server.
  yield* Effect.addFinalizer(() => unload);

  return VoiceRecognizer.of({
    unsupportedReason: Effect.succeed(unsupportedReason),
    open,
    loaded: Effect.sync(() => engine?.alive === true),
    unload,
  });
});

export const layer = Layer.effect(VoiceRecognizer, make);
