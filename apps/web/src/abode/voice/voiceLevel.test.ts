import { describe, expect, it } from "vite-plus/test";

import { levelOf, waveHeights } from "./voiceLevel";

describe("levelOf", () => {
  it("is 0 for silence and rises with loudness, capped at 1", () => {
    expect(levelOf(new Float32Array(256))).toBe(0);
    const quiet = levelOf(new Float32Array(256).fill(0.02));
    const loud = levelOf(new Float32Array(256).fill(0.3));
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
    expect(levelOf(new Float32Array(256).fill(1))).toBe(1);
  });

  it("makes normal speech clearly visible", () => {
    expect(levelOf(new Float32Array(256).fill(0.05))).toBeGreaterThan(0.4);
  });

  it("is 0 for an empty buffer", () => {
    expect(levelOf(new Float32Array(0))).toBe(0);
  });
});

describe("waveHeights", () => {
  it("rests at a low floor in silence", () => {
    for (const height of waveHeights(0)) expect(height).toBeCloseTo(0.15);
  });

  it("peaks in the middle bar and stays within 0..1", () => {
    const heights = waveHeights(1);
    expect(Math.max(...heights)).toBe(heights[Math.floor(heights.length / 2)]);
    for (const height of heights) {
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThanOrEqual(1);
    }
  });
});
