/**
 * Runs speech-to-text off the main thread so the UI never blocks. The model loads on the
 * first request (downloading into the browser Cache API) and then stays in memory.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

import { createDownloadProgress, VOICE_MODEL_DTYPE, VOICE_MODEL_ID } from "./voiceModel";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

env.allowLocalModels = false;

let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
// Serializes requests: the model is loaded once and inference is single-threaded anyway.
let queue: Promise<void> = Promise.resolve();

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
  if (request.type !== "transcribe") return;
  queue = queue.then(async () => {
    try {
      const asr = await loadRecognizer(request.id);
      const output = await asr(request.audio);
      const text = Array.isArray(output) ? output.map((part) => part.text).join(" ") : output.text;
      reply({ type: "result", id: request.id, text });
    } catch (error) {
      reply({
        type: "error",
        id: request.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
});
