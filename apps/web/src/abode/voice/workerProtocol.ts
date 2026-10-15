/** Messages between the dictation hook and `transcribe.worker.ts`. */
export type WorkerRequest =
  | { type: "transcribe"; id: number; audio: Float32Array }
  /** Stop request `id` before its next segment (the one in progress finishes first). */
  | { type: "cancel"; id: number };

export type WorkerResponse =
  | { type: "progress"; id: number; fraction: number }
  /** A recording of several segments is about to transcribe segment `current` of `total`. */
  | { type: "segment"; id: number; current: number; total: number }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id: number; message: string };
