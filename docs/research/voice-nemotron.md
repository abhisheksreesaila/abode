# Nemotron ASR on the abode host (spike)

Question: can NVIDIA Nemotron streaming ASR run natively from Node on the host, and does it beat the browser Moonshine dictation? Measured on Linux x64, 24-core CPU, RTX 3090, Node 26, with the voice-bench clips (45 short clips plus 60/120/180 s concatenations) and the bench's WER method. Nothing here is integrated into the app.

## Result

Yes. `sherpa-onnx-node` runs Nemotron natively with prebuilt binaries, streams, and finishes the final text 0.1 s after speech ends. It beats Moonshine on accuracy and wins by a wide margin on the latency a user feels.

| Setup (all Node, native)                              | WER all                   | real | dev  | noisy | long (60/120/180 s)                             | RTF 15 s / 120 s | Final text after speech ends   | RSS    | Download |
| ----------------------------------------------------- | ------------------------- | ---- | ---- | ----- | ----------------------------------------------- | ---------------- | ------------------------------ | ------ | -------- |
| Moonshine base q8, CPU (today's model, non-streaming) | 6.7%                      | 5.4% | 8.6% | 7.1%  | 209% (loops on audio > ~30 s; the app segments) | 0.055 / 0.18     | 0.8 s for 15 s; 22 s for 120 s | 3.9 GB | 64 MB    |
| Nemotron 3.5 560 ms int8, CPU, 4 threads              | 5.4%                      | 3.6% | 8.1% | 7.1%  | 3.3%                                            | 0.12 / 0.14      | 0.13 s                         | 1.4 GB | 453 MB   |
| Nemotron 3.5 1120 ms int8, CPU, 4 threads             | 6.3%                      | 5.4% | 7.5% | 6.9%  | 3.5%                                            | 0.08 / 0.08      | 0.08 s                         | 1.4 GB | 453 MB   |
| Nemotron 3.5 160 ms int8, CPU, 8 threads              | n/a (long-120 only: 6.5%) |      |      |       |                                                 | 0.37 / 0.35      | 0.33 s                         | 1.0 GB | 453 MB   |
| Nemotron 3.5 560 ms fp32, CUDA (RTX 3090)             | 4.7%                      | 4.0% | 5.9% | 6.5%  | 3.5%                                            | 0.06 / 0.05      | 0.04-0.07 s                    | 1.6 GB | 2.6 GB   |
| Nemotron EN 0.6b 160 ms int8, CPU, 8 threads          | 5.2%                      | 4.0% | 7.0% | 5.4%  | 3.0%                                            | 0.77 / 0.78      | 0.69 s                         | 1.5 GB | 447 MB   |
| Parakeet TDT v2 int8 (offline), CPU, 8 threads        | 5.6%                      | 4.7% | 7.0% | 5.6%  | 13.1% (unsegmented)                             | 0.03 / 0.05      | whole clip: 6.5 s for 120 s    | 3.2 GB | 460 MB   |
| Whisper large-v3-turbo GPU (from the brief)           | 3.9%                      |      |      |       |                                                 |                  |                                |        |          |

RTF = processing time / audio duration; below ~0.5 keeps up with live speech with headroom for slower laptops. The 24-thread runs (RTF 0.4 to 0.8) are not in the table: too many threads is the main thing that hurts sherpa here. 4 and 8 threads are the same speed (RTF 0.125 vs 0.13 at 560 ms), 12 is slower, 24 is much slower. Use 4.

Reading the table:

- Chunk size is the CPU knob. 560 ms is the best accuracy for the cost; 1120 ms halves the compute but loses about 1 point of WER; 160 ms is 3x slower and not worth it on CPU.
- Nemotron WER barely moves on long clips (3.3% at 180 s) because it streams with a cache. Moonshine cannot take long audio at all without segmentation.
- GPU needs the fp32 model: the int8 model on the CUDA provider fell back to CPU ops (RTF 0.42, no gain).
- Parakeet v2 offline is very fast on CPU (RTF 0.03 on a 15 s clip) and accurate per segment, but loses accuracy when fed 60 s or more at once.

## Runtime

Recommended: `sherpa-onnx-node` 1.13.8 (Apache-2.0). Alternatives not pursued: parakeet-rs, `handy-computer/*-gguf` (transcribe.cpp), community ONNX exports. NVIDIA publishes no ONNX itself (`.nemo`, safetensors, gguf only). k2-fsa publishes ready int8 sherpa models for Nemotron 3.5 (80/160/320/560/1120 ms), Nemotron EN, Parakeet v2/v3 and Parakeet unified; fp32 models for Nemotron 3.5 are on Hugging Face under `csukuangfj2/`.

API used: `OnlineRecognizer` with a `transducer` config, `greedy_search`, feeding PCM in 160 ms pieces, `stream.setOption("language", "en")` for the multilingual model, then `getResult(stream).text`. Output has punctuation and capitalization.

## Packaging

- npm: `sherpa-onnx-node` plus optional platform packages: `sherpa-onnx-linux-x64` (33 MB unpacked), `sherpa-onnx-darwin-arm64` (34 MB), `sherpa-onnx-win-x64` (23 MB), also darwin-x64 and linux-arm64. They install cleanly from npm. The npm build is CPU-only (onnxruntime without CUDA).
- CUDA: not on npm. It worked here by swapping the CUDA 12 shared libraries from the k2-fsa v1.13.8 release (`...cuda-12.x-cudnn-9.x-onnxruntime1.28.2-linux-x64-gpu`, 374 MB; also a Windows CUDA build and a CUDA 13 build) over the npm package's libs, with cudart, cuBLAS, cuFFT, cuRAND, cuDNN 9, nvrtc and nvjitlink 12.x on `LD_LIBRARY_PATH`. The addon needed no rebuild. This is a power-user path (users need the CUDA 12 stack); it is not something to ship by default. No Metal or CoreML provider in the npm build; macOS runs CPU (not measured here).
- Model: 453 MB download (int8), about 650 MB on disk, 1.4 GB RSS while loaded, load time about 1 s. Must be a first-use download to the host, not bundled.
- Do not run it in the Node server's main thread without care: decode is synchronous native code. Put it in a worker thread or child process.

## License

- `nvidia/nemotron-3.5-asr-streaming-0.6b`: OpenMDW-1.1, permissive.
- `nvidia/nemotron-speech-streaming-en-0.6b` and Parakeet v2: NVIDIA Open Model License (check the terms before bundling; it allows commercial use).
- sherpa-onnx: Apache-2.0.

## Recommendation for the abode server

Stream mic audio (16 kHz PCM) over the existing WebSocket to the host and run Nemotron 3.5 560 ms int8 through `sherpa-onnx-node`, CPU, 4 threads, in a worker. It runs at about 12% of real time on this machine (about 4x headroom against the 0.5 target), gives partial text while the user talks, and the final text lands about 0.13 s after they stop. Moonshine's wait grows with the recording (22 s for 120 s). Accuracy is at or above Moonshine (5.4% vs 6.7%) and stays flat on long recordings.

- Keep Moonshine in the browser as the offline/fallback path; the host path needs the model download and is only available when connected to a host.
- Offer the 1120 ms model as a "light" setting for slow laptops (RTF 0.08, about 1 WER point worse). I did not measure a laptop or a Mac; the 4x headroom is the only margin to check against.
- GPU is optional polish: RTF 0.05 and 4.7% WER, but the fp32 model is 2.6 GB and CUDA 12 libraries are needed. Not worth shipping.
- Parakeet TDT v2 offline is a good fit for the existing pause segmentation: it transcribes a typical segment in about 0.5 s at RTF 0.03, so each segment could be turned into text as soon as its pause is detected while the user is still talking. It is not needed if the streaming model is used, and it is worse on audio longer than a minute.

## Caveats

- One machine, one run per config. The TTS-made dev clips and concatenated long clips are synthetic. 45 short clips means one word is about 0.2% WER, so 5.4% vs 6.7% is a small, not decisive, gap on the short clips; the long-clip and latency gaps are the large, real ones.
- The CPU table rows were timed with the machine idle, except the CUDA full run, which overlapped another job (the quick CUDA run of the 120 s clip gave RTF 0.04).
- The 160 ms "n/a" row only ran the 120 s clip.
