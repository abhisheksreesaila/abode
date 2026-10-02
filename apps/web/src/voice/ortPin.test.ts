import { describe, expect, it } from "vite-plus/test";

import web from "../../package.json";
import transformers from "../../node_modules/@huggingface/transformers/package.json";

describe("onnxruntime-web pin", () => {
  // The worker serves ORT's wasm from our own dependency. If it drifts from the version
  // transformers.js was built against, the runtime and its glue script can mismatch.
  it("matches the version @huggingface/transformers depends on", () => {
    expect(web.dependencies["onnxruntime-web"]).toBe(transformers.dependencies["onnxruntime-web"]);
  });
});
