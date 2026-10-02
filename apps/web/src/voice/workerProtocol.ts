/** Messages between the dictation hook and `transcribe.worker.ts`. */
export type WorkerRequest = { type: "transcribe"; id: number; audio: Float32Array };

export type WorkerResponse =
  | { type: "progress"; id: number; fraction: number }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id: number; message: string };
