import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

interface PendingRequest {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onProgress: (fraction: number) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();

function ensureWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL("./transcribe.worker.ts", import.meta.url), {
    type: "module",
  });
  created.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;
    if (message.type === "progress") {
      request.onProgress(message.fraction);
      return;
    }
    pending.delete(message.id);
    if (message.type === "result") request.resolve(message.text);
    else request.reject(new Error(message.message));
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
