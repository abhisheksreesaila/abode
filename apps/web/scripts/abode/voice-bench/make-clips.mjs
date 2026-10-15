/**
 * Builds the speech clips for bench.mjs into <dataDir>/clips (a scratch dir OUTSIDE the repo).
 *
 *   node make-clips.mjs <dataDir> <libriSpeechTestCleanDir>
 *
 * - Real speech: LibriSpeech test-clean (CC BY 4.0, https://www.openslr.org/12), the first
 *   utterances of the speaker folders found under <libriSpeechTestCleanDir>.
 * - Developer-style speech: dev-sentences.json spoken by Kokoro-82M (local TTS). Install it once
 *   with `cd <dataDir> && npm i kokoro-js --ignore-scripts`.
 * - Each clip is 16 kHz mono wav + a .txt reference. Also writes timing-15s.wav: exactly 15 s of
 *   real speech, used only for the speed measurement.
 * Needs ffmpeg on PATH.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeModule from "node:module";
import * as NodeURL from "node:url";

const [dataDir, libriDir] = process.argv.slice(2);
if (!dataDir || !libriDir) throw new Error("usage: make-clips.mjs <dataDir> <libriTestCleanDir>");
const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const clips = NodePath.join(dataDir, "clips");
const tmp = NodePath.join(dataDir, "tmp");
NodeFS.mkdirSync(clips, { recursive: true });
NodeFS.mkdirSync(tmp, { recursive: true });

const ffmpeg = (...args) =>
  NodeChildProcess.execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
const to16k = (input, output) => ffmpeg("-i", input, "-ar", "16000", "-ac", "1", output);
const seconds = (wav) =>
  Number(
    NodeChildProcess.execFileSync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      wav,
    ]).toString(),
  );

// --- real speech -----------------------------------------------------------------------------
const real = [];
for (const speaker of NodeFS.readdirSync(libriDir).sort()) {
  for (const chapter of NodeFS.readdirSync(NodePath.join(libriDir, speaker)).sort()) {
    const dir = NodePath.join(libriDir, speaker, chapter);
    const lines = fs
      .readFileSync(NodePath.join(dir, `${speaker}-${chapter}.trans.txt`), "utf8")
      .trim()
      .split("\n");
    for (const line of lines.slice(0, 3)) {
      const [id, ...words] = line.split(" ");
      real.push({
        id,
        flac: NodePath.join(dir, `${id}.flac`),
        text: words.join(" ").toLowerCase(),
      });
    }
  }
}
const realWavs = [];
for (const item of real) {
  const wav = NodePath.join(tmp, `${item.id}.wav`);
  to16k(item.flac, wav);
  const length = seconds(wav);
  if (length < 5 || length > 30) continue;
  realWavs.push(wav);
  NodeFS.copyFileSync(wav, NodePath.join(clips, `real-${item.id}.wav`));
  NodeFS.writeFileSync(NodePath.join(clips, `real-${item.id}.txt`), item.text);
  if (realWavs.length >= 10) break;
}

// timing clip: 15 s of the first real clips glued together
const list = NodePath.join(tmp, "concat.txt");
NodeFS.writeFileSync(
  list,
  realWavs
    .slice(0, 4)
    .map((wav) => `file '${wav}'`)
    .join("\n"),
);
ffmpeg(
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  list,
  "-t",
  "15",
  "-c",
  "copy",
  NodePath.join(clips, "timing-15s.wav"),
);

// --- developer-style speech (TTS) ------------------------------------------------------------
const requireFromData = NodeModule.createRequire(
  NodePath.join(NodePath.resolve(dataDir), "package.json"),
);
const { KokoroTTS } = await import(
  NodeURL.pathToFileURL(requireFromData.resolve("kokoro-js")).href
);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
  dtype: "q8",
  device: "cpu",
});
const sentences = JSON.parse(
  NodeFS.readFileSync(NodePath.join(here, "dev-sentences.json"), "utf8"),
);
for (const [index, [voice, text]] of sentences.entries()) {
  const raw = NodePath.join(tmp, `dev${index}-raw.wav`);
  await (await tts.generate(text, { voice })).save(raw);
  const name = `dev-${String(index).padStart(2, "0")}`;
  to16k(raw, NodePath.join(clips, `${name}.wav`));
  NodeFS.writeFileSync(NodePath.join(clips, `${name}.txt`), text);
}
console.log(
  `wrote ${NodeFS.readdirSync(clips).filter((f) => f.endsWith(".wav")).length} clips to ${clips}`,
);
