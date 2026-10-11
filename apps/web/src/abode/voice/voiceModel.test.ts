import { describe, expect, it } from "vite-plus/test";

import { createDownloadProgress, formatModelSize } from "./voiceModel";

describe("createDownloadProgress", () => {
  it("combines per-file progress into one fraction", () => {
    const progress = createDownloadProgress();
    expect(progress({ status: "initiate", file: "a.onnx" })).toBeNull();
    expect(progress({ status: "progress", file: "a.onnx", loaded: 50, total: 100 })).toBe(0.5);
    expect(progress({ status: "progress", file: "b.onnx", loaded: 0, total: 100 })).toBe(0.25);
    expect(progress({ status: "progress", file: "b.onnx", loaded: 100, total: 100 })).toBe(0.75);
    expect(progress({ status: "done", file: "a.onnx" })).toBe(1);
  });

  it("stays quiet for cached loads that never report a size", () => {
    const progress = createDownloadProgress();
    expect(progress({ status: "ready" })).toBeNull();
    expect(progress({ status: "done", file: "cached.json" })).toBeNull();
  });
});

describe("formatModelSize", () => {
  it("rounds to whole megabytes", () => {
    expect(formatModelSize(67_000_000)).toBe("64 MB");
  });
});
