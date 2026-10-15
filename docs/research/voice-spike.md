# Voice accuracy (F-001, redone for A-024)

Question: is there a speech model clearly more accurate than Moonshine Base q8 that still transcribes 15 s of speech in about 3 s or less on this machine, in the app's WASM runtime?

## How it was measured

Rerun with `apps/web/scripts/abode/voice-bench/` (`make-clips.mjs` builds the clips, `bench.mjs` runs the models; both document their arguments). Everything downloaded stays in a scratch dir outside the repo.

- Clips (20 plus a 15 s timing clip, 16 kHz):
  - 10 real recordings: LibriSpeech test-clean (read English books, speakers 121, 1089), 5 to 30 s.
  - 10 developer sentences with code words ("rename the useThreadActionMenu hook", "run vp test in apps web", "open a pull request against nightly", "run pixi install", "fh-saas", SQLite, worktree), spoken by the Kokoro-82M local TTS in four voices. No recordings of the person's own voice exist, so these stand in; a synthetic voice is cleaner than a laptop mic but has no accent.
- WER: word error rate after lowercasing, removing punctuation and splitting `camelCase` identifiers into words. "noisy" re-runs every clip with white noise at 10 dB SNR, "quiet" at 4% volume (Moonshine and Whisper both ignore volume, so a quiet mic is not the problem).
- Speed: median of 2 to 3 runs on a 15 s clip after a warm-up, library `@huggingface/transformers` 4.3.1.
- Machine: 24-core laptop-class CPU, two RTX 3090.

## Results

Node (onnxruntime-node, 24-core CPU). This is the comparable table for accuracy and download size; its seconds are an optimistic floor.

| Model (dtype)             | WER real | WER dev sentences | WER all | WER noisy | 15 s clip (Node) | Download |
| ------------------------- | -------- | ----------------- | ------- | --------- | ---------------- | -------- |
| **moonshine-base (q8)**   | 5.4%     | 8.6%              | 6.7%    | 7.1%      | 0.9 s            | 64 MB    |
| whisper-base.en (q8)      | 6.5%     | 9.7%              | 7.8%    | 11.9%     | 1.1 s            | 76 MB    |
| distil-small.en (q8)      | 5.0%     | 11.3%             | 7.5%    | 6.9%      | 2.2 s            | 167 MB   |
| whisper-small.en (q8)     | 5.0%     | 7.0%              | 5.8%    | 6.9%      | 2.4 s            | 240 MB   |
| whisper-large-v3-turbo q8 | 4.0%     | 7.0%              | 5.2%    | 5.4%      | 5.6 s            | 1037 MB  |

What the app actually runs is single-threaded WASM (the page is not cross-origin isolated, so onnxruntime-web cannot use threads). Same 15 s clip in headless Chromium 152 against the real transformers.js web build and the app's own WASM files:

| Model (q8)             | WASM, 1 thread                                    | WASM, 4 threads (needs COOP/COEP headers) |
| ---------------------- | ------------------------------------------------- | ----------------------------------------- |
| moonshine-base         | **1.8 s**                                         | 1.1 s                                     |
| whisper-base.en        | 3.4 s                                             | 1.9 s                                     |
| distil-small.en        | 8.0 s                                             | not run                                   |
| whisper-small.en       | 9.8 s                                             | 4.5 s                                     |
| whisper-large-v3-turbo | not run (5.6 s on 24 native threads, so far over) | not run                                   |

WebGPU, Node (onnxruntime-node with the GPU provider, RTX 3090, fp32/fp16 weights, q8 does not run on the GPU: 6.6 s for whisper-base.en):

| Model                                     | WER real | WER dev | WER all | WER noisy | 15 s clip | Download |
| ----------------------------------------- | -------- | ------- | ------- | --------- | --------- | -------- |
| whisper-small.en (fp32)                   | 5.0%     | 7.0%    | 5.8%    | 6.0%      | 0.8 s     | 926 MB   |
| whisper-large-v3-turbo (enc fp32, dec q4) | 2.9%     | 5.4%    | 3.9%    | 4.5%      | 0.8 s     | 2752 MB  |

Browser WebGPU could not be measured: headless Chromium 152 on this machine reports no adapter by default and only a software one (SwiftShader, 40 s for the same clip) with GPU flags. Whether the person's real Chromium or Electron 44 exposes the NVIDIA GPU through Vulkan is unknown; Linux Chromium has historically had WebGPU off by default. The fp16 weights failed to load in Node (an onnxruntime-node graph error), so a smaller turbo download (fp16 encoder) is unmeasured.

## Long recordings (the likely real failure)

The person dictates 1 to 3 minutes at a time, and the app used to hand the whole recording to the model in one call. Every clip above is 30 s or shorter, so none of it tested that. Rerun with `make-long-clips.mjs` and `bench-long.mjs`: three long clips (64, 120 and 185 s) built from LibriSpeech and developer sentences with 0.5 to 1.5 s silent gaps; the reference is the concatenated text. There are no "um"/"uh" fillers, since no local TTS speaks them. Node CPU, q8:

| Model            | Length           | One call on the whole clip                                | transformers.js `chunk_length_s` 30 / `stride_length_s` 5 | Split at pauses into pieces of 30 s or less  |
| ---------------- | ---------------- | --------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| moonshine-base   | 64 s             | WER 119.7% (213 words for 137), 8.0 s                     | identical to whole (option ignored)                       | **WER 5.8%**, 2.8 s                          |
| moonshine-base   | 120 s            | WER 253.2% (717 words for 278), 21.7 s                    | identical to whole                                        | **WER 4.0%**, 5.3 s                          |
| moonshine-base   | 185 s            | WER 209.8% (964 words for 439), 47.0 s                    | identical to whole                                        | **WER 1.4%**, 8.4 s                          |
| whisper-base.en  | 64 / 120 / 185 s | WER 52.6% / 95.0% / 90.7% (it stops after the first 30 s) | WER 32.1% / 83.5% / 53.1%                                 | WER 5.1% / 5.0% / 4.8%, 3.8 / 6.9 / 10.4 s   |
| whisper-small.en | 64 / 120 / 185 s | WER 49.6% / 94.6% / 82.2%                                 | WER 50.4% / 74.5% / 5.5%                                  | WER 5.8% / 10.8% / 6.6%, 7.7 / 14.4 / 20.8 s |

- Past 30 s Moonshine loops: it produces 2 to 3 times the words, repeating phrases, so WER is above 100% and the text is unusable. The whole-clip call is also slow (47 s of CPU for 185 s) because it decodes those runaway tokens. This is the failure the person met.
- Moonshine ignores `chunk_length_s` / `stride_length_s`: the output is word for word the same as the unchunked call. They only act on Whisper, and even there they are unreliable (whisper-base.en still loses half the text at 185 s).
- Splitting at pauses fixes it: Moonshine goes from 120 to 250% WER to 1.4 to 5.8%, close to its short-clip accuracy, and it is 5 to 6 times faster.
- Time in the app's real runtime (single-thread WASM, headless Chromium, the 185 s clip in 8 segments): **20.9 s**, about 0.11 times real time. The 15 s speed limit still holds per segment (about 1.8 s for 15 s).
- Segmenting does not let a better model fit: whisper-small.en needs 9.8 s per 15 s in single-thread WASM, which is about 2 minutes for the 185 s clip, and its accuracy gain over Moonshine is small (5.8 to 6.6% against 1.4 to 5.8% here, with a gap in its 120 s output).
- One implementation lesson: Moonshine returned an empty string for a segment that began with 0.65 s of digital silence (the cut pause), and the same audio transcribed fine once the silence was trimmed. Each segment is therefore trimmed to its speech plus 0.15 s.

## What the numbers say

- Under the speed limit in the browser only Moonshine Base fits (1.8 s). The next model up, whisper-base.en, is slower (3.4 s) and less accurate (7.8% vs 6.7%, much worse in noise). Everything more accurate on CPU (small.en 5.8%, turbo 5.2%) takes 4.5 to 10 s or more in the browser. Moonshine Base is already the best model for this runtime, so switching to another WASM model would make dictation slower without a real accuracy gain.
- The model is not what makes the dev sentences wrong. Moonshine's 8.6% on them is almost entirely vocabulary it has never seen as one word: "work tree", "Pixie install", "sq. light", "web socket", "a Bode Next", "use effect", "T three". Whisper small makes the same mistakes ("work tree", "SQ light", "a bode next").
- The big accuracy jump is WebGPU with whisper-large-v3-turbo (3.9% vs 6.7%, 0.8 s), at a 2.7 GB download and with no way to confirm it in a browser here.

## Decision

Keep Moonshine Base q8 (`onnx-community/moonshine-base-ONNX`, about 64 MB, 1.8 s per 15 s in the app's runtime). No model-cache change: the id is the same, so there is nothing to clean up, and Settings keeps showing the real size of the cached files.

Fix the long-recording failure: the worker no longer passes the whole recording to the model. `segmentAudio.ts` (a pure function) splits it at pauses into segments of at most 30 s (preferring the longest pause 20 to 25 s in, else the latest pause before 30 s, else a hard cut at 30 s), trims each segment to its speech, and the worker transcribes them in order and joins the text. A recording of 30 s or less goes through untouched. This is the change that matters most for 1 to 3 minute prompts.

Add a small developer vocabulary (`apps/web/src/abode/voice/devVocabulary.ts`), applied to every transcript: worktree, websocket, pixi, SQLite, fh-saas, abode, T3, and the `useEffect` / `useMemo` / `useCallback` hooks. Only phrases that are almost never meant literally in a prompt to a coding agent are in it. On the bench it takes Moonshine's developer-sentence WER from 8.6% to 2.7% (real speech unchanged at 5.4%, overall 6.7% to 4.3%); that number is in-sample, because the rules were written from these same sentences, so expect a smaller gain on new ones. The same list also takes whisper-small.en from 7.0% to 1.6% on those sentences.

Not done, and why (each needs a decision or a measurement only a real browser can give):

1. WebGPU with a WASM fallback for whisper-large-v3-turbo. Worth doing if the person's Chromium/Electron reports a real GPU adapter (`navigator.gpu.requestAdapter()` on a visible window) and a 1.5 to 2.7 GB one-time download is acceptable. It would be a second cached model, chosen at runtime, with Moonshine as the fallback.
2. Cross-origin isolation (COOP/COEP headers) so onnxruntime-web can use threads. It speeds every model by about 1.7x (whisper-small.en would still take 4.5 s), but it is a server or Electron change outside `abode/voice` and may break embedded cross-origin content.
3. Real-microphone check. Drop recordings of the person's own prompts as `name.wav` plus `name.txt` into the clips folder and rerun `bench.mjs`; that is the only way to know whether accent or microphone, not vocabulary, is the remaining problem.
