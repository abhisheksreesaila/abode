import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

export interface PendingRequest {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onProgress: (fraction: number) => void;
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
  requests.delete(message.id);
  if (message.type === "result") request.resolve(message.text);
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

/** 16 kHz mono samples in, text out. Transfers the buffer to the worker. */
export function transcribe(audio: Float32Array, onProgress: (fraction: number) => void) {
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    const request: WorkerRequest = { type: "transcribe", id, audio };
    ensureWorker().postMessage(request, [audio.buffer]);
  });
}

/** Drops the loaded model from memory (used after deleting it from disk). */
export function resetTranscriber() {
  worker?.terminate();
  worker = null;
  failAll(new Error("Speech model reset."));
}
