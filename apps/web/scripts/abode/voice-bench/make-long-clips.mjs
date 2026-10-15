/**
 * Builds long recordings (60, 120 and 180 s) for bench-long.mjs into <dataDir>/long.
 *
 *   node make-long-clips.mjs <dataDir> <libriSpeechTestCleanDir>
 *
 * Run make-clips.mjs first (it writes the developer sentences). Each long clip glues LibriSpeech
 * utterances (three of every four) and developer sentences (one of every four) together with
 * silent gaps of 0.5 to 1.5 s, and the reference text is the concatenated references. There are
 * no "um"/"uh" fillers: no local TTS here speaks them, so the gaps are the only pauses.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const [dataDir, libriDir] = process.argv.slice(2);
if (!dataDir || !libriDir)
  throw new Error("usage: make-long-clips.mjs <dataDir> <libriTestCleanDir>");
const RATE = 16_000;
const out = NodePath.join(dataDir, "long");
NodeFS.mkdirSync(out, { recursive: true });

const decode = (file) => {
  const raw = NodeChildProcess.execFileSync(
    "ffmpeg",
    ["-loglevel", "error", "-i", file, "-f", "f32le", "-ar", String(RATE), "-ac", "1", "-"],
    { maxBuffer: 1 << 28 },
  );
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
};

const libri = [];
for (const speaker of NodeFS.readdirSync(libriDir).sort()) {
  for (const chapter of NodeFS.readdirSync(NodePath.join(libriDir, speaker)).sort()) {
    const dir = NodePath.join(libriDir, speaker, chapter);
    const lines = NodeFS.readFileSync(NodePath.join(dir, `${speaker}-${chapter}.trans.txt`), "utf8")
      .trim()
      .split("\n");
    for (const line of lines) {
      const [id, ...words] = line.split(" ");
      libri.push({ file: NodePath.join(dir, `${id}.flac`), text: words.join(" ").toLowerCase() });
    }
  }
}
const dev = NodeFS.readdirSync(NodePath.join(dataDir, "clips"))
  .filter((f) => f.startsWith("dev-") && f.endsWith(".wav"))
  .sort()
  .map((f) => ({
    file: NodePath.join(dataDir, "clips", f),
    text: NodeFS.readFileSync(NodePath.join(dataDir, "clips", f.replace(".wav", ".txt")), "utf8"),
  }));

let seed = 7;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

let libriIndex = 0;
let devIndex = 0;
let step = 0;
// Distinct utterances per clip, so each long clip has different content.
for (const target of [60, 120, 180]) {
  const parts = [];
  const texts = [];
  let samples = 0;
  while (samples < target * RATE) {
    const useDev = step++ % 4 === 3;
    const item = useDev ? dev[devIndex++ % dev.length] : libri[libriIndex++ % libri.length];
    const audio = decode(item.file);
    if (samples + audio.length > (target + 8) * RATE) continue;
    const gap = new Float32Array(Math.round((0.5 + random()) * RATE));
    parts.push(audio, gap);
    texts.push(item.text);
    samples += audio.length + gap.length;
  }
  const all = new Float32Array(samples);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  const name = `long-${String(target).padStart(3, "0")}`;
  NodeChildProcess.execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "f32le",
      "-ar",
      String(RATE),
      "-ac",
      "1",
      "-i",
      "-",
      NodePath.join(out, `${name}.wav`),
    ],
    { input: Buffer.from(all.buffer) },
  );
  NodeFS.writeFileSync(NodePath.join(out, `${name}.txt`), texts.join(" "));
  console.log(
    `${name}: ${(samples / RATE).toFixed(1)} s, ${texts.join(" ").split(" ").length} words`,
  );
}
