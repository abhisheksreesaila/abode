# Voice spike (F-001)

Adapted run (no live recordings, overnight): transformers.js 4.3.0 in Node 26, WASM/CPU (onnxruntime), 24-core laptop, q8 models. Audio was the public JFK sample (11 s) plus flite-synthesized prompts with code words (3.7 s and an 11.5 s concatenation). Load time includes the first download. A synthetic voice is harsher than a human one, so absolute accuracy is pessimistic; the ranking is what matters.

| Model (q8)         | Download  | Load   | 11.5 s clip | Notes                                           |
| ------------------ | --------- | ------ | ----------- | ----------------------------------------------- |
| moonshine-tiny     | 31 MB     | 7.8 s  | 0.47 s      | Several errors ("Vfh. Sons", "Pxe")             |
| **moonshine-base** | **64 MB** | 15.6 s | **0.74 s**  | Best on code words                              |
| whisper-tiny.en    | 42 MB     | 10.0 s | 0.95 s      | Good punctuation, "FH saws", "login reader egg" |
| whisper-base.en    | 76 MB     | 18.6 s | 2.13 s      | "FHSAUZ", "pxinstall"; slowest                  |

Transcripts (11.5 s code-word clip, spoken: "...route to the fh-saas app... run pixi install... fh-saas login redirect fails"):

- moonshine-base: "Add a root to the FH Sawz app ... Switch to the Work Tree Branch, Run Peak Seawenz Tall ... FH Sawz login redirect fails."
- whisper-tiny.en: "Add a root to the FH saws app ... run pixie install ... login reader egg fails."
- whisper-base.en: "Add a root to the FHSAUZ app ... run pxinstall ... FHSAUZ ligand reader X fails."

"worktree" comes out as "work tree" and "pixi" as "Pixie" in every model; "fh-saas" is never right. These are vocabulary problems no model fixes; a small replacement list (work tree -> worktree, pixie -> pixi) is a cheap follow-up, not part of F-002.

## Decision

Moonshine base q8 (`onnx-community/moonshine-base-ONNX`, about 64 MB). All four are far under the 2 s target on CPU/WASM (0.7 s for 11.5 s), and base was the most accurate and about 3x faster than whisper-base.en. Real-microphone accuracy was not measured; the main session should dictate a few real prompts in the app. Browser WebGPU will usually be faster than these Node CPU numbers, but F-002 uses WASM first (fewer failure modes); WebGPU is a later switch of the `device` option. Fall back to whisper-tiny.en if Moonshine misbehaves in the browser worker.
