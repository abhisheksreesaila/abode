/**
 * Long recordings (60 to 180 s, from make-long-clips.mjs): how does each way of feeding a long
 * recording to the model compare?
 *
 *   node bench-long.mjs --long <dataDir>/long --cache <dataDir>/models [--models a,b]
 *
 * Strategies: "whole" = one asr(audio) call (what the app did before segmenting), "segments" =
 * split at pauses into pieces of at most 30 s (segmentAudio.ts, what the app does now) and joined,
 * "chunk" = transformers.js's own chunk_length_s 30 / stride_length_s 5.
 * Node CPU timings: see voice-spike.md for the app's single-thread WASM numbers.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { segmentAudio } from "../../../src/abode/voice/segmentAudio.ts";
import { editDistance, normalize } from "./wer.mjs";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .flatMap((arg, i, all) => (arg.startsWith("--") ? [[arg.slice(2), all[i + 1]]] : [])),
);
env.cacheDir = args.cache;
env.allowLocalModels = false;

const MODELS = {
  "moonshine-base-q8": "onnx-community/moonshine-base-ONNX",
  "whisper-base.en-q8": "onnx-community/whisper-base.en",
  "whisper-small.en-q8": "onnx-community/whisper-small.en",
};
const keys = (args.models ?? Object.keys(MODELS).join(",")).split(",");

const clips = NodeFS.readdirSync(args.long)
  .filter((f) => f.endsWith(".wav"))
  .sort()
  .map((f) => {
    const raw = NodeChildProcess.execFileSync(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-i",
        NodePath.join(args.long, f),
        "-f",
        "f32le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-",
      ],
      { maxBuffer: 1 << 29 },
    );
    return {
      name: f.replace(".wav", ""),
      audio: new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)),
      ref: normalize(
        NodeFS.readFileSync(NodePath.join(args.long, f.replace(".wav", ".txt")), "utf8"),
      ),
    };
  });

const textOf = (out) => (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).trim();

console.log("| Model | Length | Strategy | WER | Words kept | Time (Node) |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const key of keys) {
  const asr = await pipeline("automatic-speech-recognition", MODELS[key], {
    dtype: "q8",
    device: "cpu",
  });
  await asr(clips[0].audio.slice(0, 16000 * 3));
  for (const clip of clips) {
    const strategies = {
      whole: () => asr(clip.audio).then(textOf),
      segments: async () => {
        const parts = [];
        for (const { start, end } of segmentAudio(clip.audio)) {
          parts.push(textOf(await asr(clip.audio.slice(start, end))));
        }
        return parts.join(" ");
      },
      chunk: () => asr(clip.audio, { chunk_length_s: 30, stride_length_s: 5 }).then(textOf),
    };
    for (const [strategy, run] of Object.entries(strategies)) {
      const start = performance.now();
      let text;
      try {
        text = await run();
      } catch (error) {
        console.log(
          `| ${key} | ${clip.name} | ${strategy} | error: ${String(error.message).slice(0, 60)} | | |`,
        );
        continue;
      }
      const seconds = (performance.now() - start) / 1000;
      const hyp = normalize(text);
      console.log(
        `| ${key} | ${clip.name} | ${strategy} | ${((editDistance(clip.ref, hyp) / clip.ref.length) * 100).toFixed(1)}% | ${hyp.length}/${clip.ref.length} | ${seconds.toFixed(1)} s |`,
      );
    }
  }
}
