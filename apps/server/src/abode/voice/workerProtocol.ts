/** Messages between `VoiceRecognizerSherpa` and `voiceWorker`. `id` names one dictation. */
export type ToWorker =
  | { readonly type: "open"; readonly id: number }
  | { readonly type: "audio"; readonly id: number; readonly samples: Float32Array }
  | { readonly type: "finish"; readonly id: number }
  | { readonly type: "close"; readonly id: number };

export type FromWorker =
  | { readonly type: "ready" }
  | { readonly type: "load-failed"; readonly message: string }
  | { readonly type: "text"; readonly id: number; readonly text: string }
  | { readonly type: "failed"; readonly id: number; readonly message: string };
