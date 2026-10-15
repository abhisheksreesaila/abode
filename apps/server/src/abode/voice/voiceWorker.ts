/**
 * Worker thread that owns the speech model. sherpa-onnx decodes in synchronous native code, so
 * it must never run on the server's event loop; this thread does all of it. Built as its own
 * bundle entry (`vite.config.ts`) and started by `VoiceRecognizerSherpa`.
 */
import * as NodeModule from "node:module";
import * as NodeWorkerThreads from "node:worker_threads";

import type { FromWorker, ToWorker } from "./workerProtocol.ts";

interface SherpaStream {
  acceptWaveform(input: { sampleRate: number; samples: Float32Array }): void;
  inputFinished(): void;
  setOption(key: string, value: string): void;
}
interface SherpaRecognizer {
  createStream(): SherpaStream;
  isReady(stream: SherpaStream): boolean;
  decode(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { text: string };
}

const SAMPLE_RATE = 16_000;
/** Silence appended on finish so the last chunk's words leave the model's look-ahead. */
const TAIL_SILENCE_SAMPLES = SAMPLE_RATE;

const { parentPort: port, workerData } = NodeWorkerThreads;
if (!port) throw new Error("voiceWorker must run as a worker thread");
const send = (message: FromWorker) => port.postMessage(message);

const { modelDir, threads } = workerData as { modelDir: string; threads: number };

function loadRecognizer(): SherpaRecognizer {
  const sherpa = NodeModule.createRequire(import.meta.url)("sherpa-onnx-node") as {
    OnlineRecognizer: new (config: unknown) => SherpaRecognizer;
  };
  return new sherpa.OnlineRecognizer({
    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: `${modelDir}/encoder.int8.onnx`,
        decoder: `${modelDir}/decoder.int8.onnx`,
        joiner: `${modelDir}/joiner.int8.onnx`,
      },
      tokens: `${modelDir}/tokens.txt`,
      numThreads: threads,
      provider: "cpu",
      debug: 0,
    },
    decodingMethod: "greedy_search",
    enableEndpoint: 0,
  });
}

let recognizer: SherpaRecognizer | undefined;
try {
  recognizer = loadRecognizer();
} catch (error) {
  send({ type: "load-failed", message: error instanceof Error ? error.message : String(error) });
}

if (recognizer) {
  const model = recognizer;
  const streams = new Map<number, SherpaStream>();
  const decodeReady = (stream: SherpaStream) => {
    while (model.isReady(stream)) model.decode(stream);
  };

  port.on("message", (message: ToWorker) => {
    try {
      if (message.type === "open") {
        const stream = model.createStream();
        stream.setOption("language", "en");
        streams.set(message.id, stream);
        return;
      }
      const stream = streams.get(message.id);
      if (!stream) return;
      if (message.type === "audio") {
        stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: message.samples });
        decodeReady(stream);
      } else if (message.type === "finish") {
        stream.acceptWaveform({
          sampleRate: SAMPLE_RATE,
          samples: new Float32Array(TAIL_SILENCE_SAMPLES),
        });
        stream.inputFinished();
        decodeReady(stream);
        send({ type: "text", id: message.id, text: model.getResult(stream).text });
        streams.delete(message.id);
      } else {
        streams.delete(message.id);
      }
    } catch (error) {
      streams.delete(message.id);
      send({
        type: "failed",
        id: message.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
  send({ type: "ready" });
}
