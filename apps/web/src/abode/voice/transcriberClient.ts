import { applyDevVocabulary } from "./devVocabulary";
import { SPEECH_SAMPLE_RATE } from "./pcmBuffer";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

export interface PendingRequest {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onProgress: (fraction: number) => void;
  /** Segment `current` of `total` is about to be transcribed (recordings over 30 s only). */
  onSegment?: ((current: number, total: number) => void) | undefined;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();

/**
 * Routes one worker message. Progress is broadcast: the model download is attributed to
 * whichever request triggered the load, but every waiting request wants to show it.
 */
export function routeWorkerMessage(requests: Map<number, PendingRequest>, message: WorkerResponse) {
  if (message.type === "progress") {
    for (const request of requests.values()) request.onProgress(message.fraction);
    return;
  }
  const request = requests.get(message.id);
  if (!request) return;
  if (message.type === "segment") {
    request.onSegment?.(message.current, message.total);
    return;
  }
  requests.delete(message.id);
  if (message.type === "result") request.resolve(applyDevVocabulary(message.text));
  else request.reject(new Error(message.message));
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL("./transcribe.worker.ts", import.meta.url), {
    type: "module",
  });
  created.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    routeWorkerMessage(pending, event.data);
  });
  created.addEventListener("error", (event) => {
    failAll(new Error(event.message || "The speech worker crashed."));
    resetTranscriber();
  });
  worker = created;
  return created;
}

function failAll(error: Error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

export interface TranscribeOptions {
  onSegment?: ((current: number, total: number) => void) | undefined;
  /** Aborting rejects with an AbortError and stops the worker before its next segment. */
  signal?: AbortSignal;
}

/** 16 kHz mono samples in, text out. Transfers the buffer to the worker. */
export function transcribe(
  audio: Float32Array,
  onProgress: (fraction: number) => void,
  options: TranscribeOptions = {},
) {
  const id = nextId++;
  const { signal, onSegment } = options;
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Transcription cancelled.", "AbortError"));
      return;
    }
    pending.set(id, { resolve, reject, onProgress, onSegment });
    signal?.addEventListener(
      "abort",
      () => {
        if (!pending.delete(id)) return;
        const cancel: WorkerRequest = { type: "cancel", id };
        worker?.postMessage(cancel, []);
        reject(new DOMException("Transcription cancelled.", "AbortError"));
      },
      { once: true },
    );
    const request: WorkerRequest = { type: "transcribe", id, audio };
    ensureWorker().postMessage(request, [audio.buffer]);
  });
}

let warming: Promise<void> | null = null;
let onWarmProgress: ((fraction: number) => void) | null = null;

/**
 * Loads the model in the background (a tiny silent transcription) so the real one after
 * release is quick. One load per worker: a later call joins the one in flight and takes over
 * its progress. Settles when the model is ready, or when loading failed (it retries next time).
 */
export function warmTranscriber(onProgress: (fraction: number) => void): Promise<void> {
  onWarmProgress = onProgress;
  warming ??= transcribe(new Float32Array(SPEECH_SAMPLE_RATE / 2), (fraction) =>
    onWarmProgress?.(fraction),
  ).then(
    () => undefined,
    () => {
      warming = null;
    },
  );
  return warming;
}

/** Drops the loaded model from memory (used after deleting it from disk). */
export function resetTranscriber() {
  worker?.terminate();
  worker = null;
  warming = null;
  failAll(new Error("Speech model reset."));
}
