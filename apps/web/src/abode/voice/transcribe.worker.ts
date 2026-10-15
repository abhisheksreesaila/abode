/**
 * Runs speech-to-text off the main thread so the UI never blocks. The model loads on the
 * first request (downloading into the browser Cache API) and then stays in memory.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

import { transcribeSegments } from "./transcribeSegments";
import { createDownloadProgress, VOICE_MODEL_DTYPE, VOICE_MODEL_ID } from "./voiceModel";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

env.allowLocalModels = false;

// Serve the ONNX runtime from our own bundle (same origin, so it works offline and under
// the desktop CSP) instead of transformers.js's default of loading it from cdn.jsdelivr.net.
// The files are referenced by path because onnxruntime-web's package exports hide dist/.
const ortWasmUrl = new URL(
  "../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm",
  import.meta.url,
).href;
const ortModuleUrl = new URL(
  "../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs",
  import.meta.url,
).href;
env.useWasmCache = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortModuleUrl };
}

let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
// Serializes requests: the model is loaded once and inference is single-threaded anyway.
let queue: Promise<void> = Promise.resolve();
// Ids of requests the user cancelled; their segment loop stops at the next boundary.
const cancelled = new Set<number>();

function reply(message: WorkerResponse) {
  postMessage(message);
}

function loadRecognizer(id: number): Promise<AutomaticSpeechRecognitionPipeline> {
  if (recognizer) return recognizer;
  const toFraction = createDownloadProgress();
  const loading = pipeline("automatic-speech-recognition", VOICE_MODEL_ID, {
    dtype: VOICE_MODEL_DTYPE,
    device: "wasm",
    progress_callback: (event) => {
      const fraction = toFraction(event);
      if (fraction !== null) reply({ type: "progress", id, fraction });
    },
  });
  // A failed load (offline first run) must not poison the next attempt.
  recognizer = loading.catch((error: unknown) => {
    recognizer = null;
    throw error;
  });
  return recognizer;
}

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === "cancel") {
    // Handled between the awaits of the running request, so it takes effect before the next segment.
    cancelled.add(request.id);
    return;
  }
  queue = queue.then(async () => {
    try {
      const asr = await loadRecognizer(request.id);
      // The model is trained on clips of up to 30 s and repeats or drops text on longer ones, so
      // a long recording goes through in pieces cut at pauses (segmentAudio.ts).
      const text = await transcribeSegments(
        request.audio,
        async (segment) => {
          const output = await asr(segment);
          return Array.isArray(output) ? output.map((part) => part.text).join(" ") : output.text;
        },
        {
          isCancelled: () => cancelled.has(request.id),
          onSegment: (current, total) => reply({ type: "segment", id: request.id, current, total }),
        },
      );
      // A cancelled request has no listener left; say nothing.
      if (text !== null) reply({ type: "result", id: request.id, text });
      cancelled.delete(request.id);
    } catch (error) {
      cancelled.delete(request.id);
      reply({
        type: "error",
        id: request.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
});
