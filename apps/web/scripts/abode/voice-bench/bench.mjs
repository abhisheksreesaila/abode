/**
 * Compares speech-to-text models on the clips from make-clips.mjs, using the same library the app
 * uses (@huggingface/transformers). Reports word error rate (real speech, developer sentences),
 * seconds to transcribe 15 s of audio, and download size.
 *
 *   node bench.mjs --clips <dataDir>/clips --cache <dataDir>/models [--device cpu|webgpu]
 *                  [--models moonshine-base-q8,whisper-base.en-q8] [--runs 3] [--vocab 1] [--out results.json]
 *
 * Node runs onnxruntime-node (native CPU), which is faster than the app's WASM build, so the
 * seconds here are an optimistic floor for the app; `--device webgpu` is only meaningful where
 * onnxruntime-node ships a WebGPU provider. Run from anywhere; the data stays outside the repo.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { env, pipeline } from "@huggingface/transformers";
import { applyDevVocabulary } from "../../../src/abode/voice/devVocabulary.ts";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .flatMap((arg, i, all) => (arg.startsWith("--") ? [[arg.slice(2), all[i + 1]]] : [])),
);
const clipsDir = args.clips;
const cacheDir = args.cache;
if (!clipsDir || !cacheDir)
  throw new Error("usage: bench.mjs --clips <dir> --cache <dir> [--device cpu|webgpu]");
const device = args.device ?? "cpu";
/** The "noisy" column re-runs every clip with Gaussian noise at this signal-to-noise ratio. */
const NOISE_SNR_DB = 10;
/** The "quiet" column scales every clip down, like a distant or low-gain microphone. */
const QUIET_GAIN = 0.04;
const runs = Number(args.runs ?? 3);
const vocab = args.vocab === "1";
env.cacheDir = cacheDir;
env.allowLocalModels = false;

/** key -> [model id, dtype]. dtype may be a string or a per-submodel object. */
const CANDIDATES = {
  "moonshine-base-q8": ["onnx-community/moonshine-base-ONNX", "q8"],
  "whisper-base.en-q8": ["onnx-community/whisper-base.en", "q8"],
  "whisper-small.en-q8": ["onnx-community/whisper-small.en", "q8"],
  // fp16 / fp32 are for --device webgpu; onnxruntime-node's CPU build cannot load the fp16 decoder.
  "whisper-small.en-fp16": ["onnx-community/whisper-small.en", "fp16"],
  "whisper-small.en-fp32": ["onnx-community/whisper-small.en", "fp32"],
  "whisper-large-v3-turbo-enc32-dec-q4": [
    "onnx-community/whisper-large-v3-turbo",
    { encoder_model: "fp32", decoder_model_merged: "q4" },
  ],
  "whisper-large-v3-turbo-q4": [
    "onnx-community/whisper-large-v3-turbo",
    { encoder_model: "fp16", decoder_model_merged: "q4" },
  ],
  "whisper-large-v3-turbo-q8": ["onnx-community/whisper-large-v3-turbo", "q8"],
  "distil-small.en-q8": ["onnx-community/distil-small.en", "q8"],
};
const keys = (args.models ?? Object.keys(CANDIDATES).join(",")).split(",");

function readWav(file) {
  const raw = NodeChildProcess.execFileSync(
    "ffmpeg",
    ["-loglevel", "error", "-i", file, "-f", "f32le", "-ar", "16000", "-ac", "1", "-"],
    { maxBuffer: 1 << 28 },
  );
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

// Identifiers split at camelCase ("useEffect" = "use effect"), and spoken numbers match digits.
const normalize = (text) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\bt three\b/g, "t3")
    .replace(/\bthree thousand\b/g, "3000")
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function editDistance(ref, hyp) {
  let previous = Array.from({ length: hyp.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ref.length; i++) {
    const row = [i];
    for (let j = 1; j <= hyp.length; j++) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return previous[hyp.length];
}

function dirBytes(dir) {
  if (!NodeFS.existsSync(dir)) return 0;
  return NodeFS.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = NodePath.join(dir, entry.name);
    return sum + (entry.isDirectory() ? dirBytes(full) : NodeFS.statSync(full).size);
  }, 0);
}

/** Deterministic Gaussian noise at the given SNR (dB): a stand-in for a laptop mic in a room. */
function addNoise(audio, snrDb) {
  let power = 0;
  for (const x of audio) power += x * x;
  const sigma = Math.sqrt(power / audio.length / 10 ** (snrDb / 10));
  let seed = 12345;
  const uniform = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) + 1) / 4294967297;
  return audio.map(
    (x) => x + sigma * Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform()),
  );
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const clips = fs
  .readdirSync(clipsDir)
  .filter(
    (f) =>
      f.endsWith(".wav") && NodeFS.existsSync(NodePath.join(clipsDir, f.replace(".wav", ".txt"))),
  )
  .sort()
  .map((f) => ({
    name: f,
    group: f.startsWith("real-") ? "real" : "dev",
    audio: readWav(NodePath.join(clipsDir, f)),
    ref: normalize(NodeFS.readFileSync(NodePath.join(clipsDir, f.replace(".wav", ".txt")), "utf8")),
  }));
const timingClip = readWav(NodePath.join(clipsDir, "timing-15s.wav"));

const results = [];
for (const key of keys) {
  const [id, dtype] = CANDIDATES[key];
  // Start from an empty cache for this model so the download size is exactly this dtype's.
  NodeFS.rmSync(NodePath.join(cacheDir, id), { recursive: true, force: true });
  const loadStart = performance.now();
  const asr = await pipeline("automatic-speech-recognition", id, { dtype, device });
  const loadSeconds = (performance.now() - loadStart) / 1000;
  const transcribe = async (audio) => {
    const out = await asr(audio, id.includes("whisper") ? { chunk_length_s: 30 } : {});
    const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).trim();
    return vocab ? applyDevVocabulary(text) : text;
  };
  await transcribe(timingClip.slice(0, 16000 * 3)); // warm-up (graph optimisation, kernels)

  const edits = { real: 0, dev: 0, noisy: 0, quiet: 0 };
  const words = { real: 0, dev: 0, noisy: 0, quiet: 0 };
  const transcripts = {};
  for (const clip of clips) {
    const text = await transcribe(clip.audio);
    transcripts[clip.name] = text;
    edits[clip.group] += editDistance(clip.ref, normalize(text));
    words[clip.group] += clip.ref.length;
    const noisy = await transcribe(addNoise(clip.audio, NOISE_SNR_DB));
    transcripts[`${clip.name} (noisy)`] = noisy;
    edits.noisy += editDistance(clip.ref, normalize(noisy));
    words.noisy += clip.ref.length;
    const quiet = await transcribe(clip.audio.map((x) => x * QUIET_GAIN));
    transcripts[`${clip.name} (quiet)`] = quiet;
    edits.quiet += editDistance(clip.ref, normalize(quiet));
    words.quiet += clip.ref.length;
  }
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await transcribe(timingClip);
    times.push((performance.now() - start) / 1000);
  }
  const row = {
    key: vocab ? `${key} + dev vocabulary` : key,
    device,
    werReal: edits.real / words.real,
    werDev: edits.dev / words.dev,
    werAll: (edits.real + edits.dev) / (words.real + words.dev),
    werNoisy: edits.noisy / words.noisy,
    werQuiet: edits.quiet / words.quiet,
    seconds15: median(times),
    downloadMB: dirBytes(NodePath.join(cacheDir, id)) / (1024 * 1024),
    loadSeconds,
    transcripts,
  };
  results.push(row);
  console.error(
    `${key}: WER ${(row.werAll * 100).toFixed(1)}% (noisy ${(row.werNoisy * 100).toFixed(1)}%, quiet ${(row.werQuiet * 100).toFixed(1)}%) in ${row.seconds15.toFixed(2)} s`,
  );
  await asr.dispose?.();
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log(
  `| Model (${device}) | WER real | WER dev | WER all | WER noisy | WER quiet | 15 s clip | Download | Load |`,
);
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of results) {
  console.log(
    `| ${r.key} | ${pct(r.werReal)} | ${pct(r.werDev)} | ${pct(r.werAll)} | ${pct(r.werNoisy)} | ${pct(r.werQuiet)} | ${r.seconds15.toFixed(2)} s | ${r.downloadMB.toFixed(0)} MB | ${r.loadSeconds.toFixed(1)} s |`,
  );
}
if (args.out) NodeFS.writeFileSync(args.out, JSON.stringify(results, null, 2));
