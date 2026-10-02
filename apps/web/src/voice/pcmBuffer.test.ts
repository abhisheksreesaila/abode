import { describe, expect, it } from "vite-plus/test";

import { createDownsampler, createPcmStore } from "./pcmBuffer";

describe("createDownsampler", () => {
  it("averages 48 kHz down to 16 kHz across chunk boundaries", () => {
    const down = createDownsampler(48_000);
    const a = down(Float32Array.from([1, 1, 1, 2, 2]));
    const b = down(Float32Array.from([2, 3, 3, 3]));
    expect([...a, ...b]).toEqual([1, 2, 3]);
  });

  it("passes 16 kHz through unchanged", () => {
    const down = createDownsampler(16_000);
    expect([...down(Float32Array.from([0.5, -0.5]))]).toEqual([0.5, -0.5]);
  });

  it("produces one sample per ratio for fractional rates", () => {
    const down = createDownsampler(44_100);
    const out = down(new Float32Array(44_100));
    expect(Math.abs(out.length - 16_000)).toBeLessThanOrEqual(1);
  });
});

describe("createPcmStore", () => {
  it("returns everything, or a bounded tail flagged as truncated", () => {
    const store = createPcmStore();
    store.push(Float32Array.from([1, 2, 3]));
    store.push(Float32Array.from([4, 5]));
    expect([...store.all()]).toEqual([1, 2, 3, 4, 5]);
    expect(store.tail(10)).toEqual({ audio: Float32Array.from([1, 2, 3, 4, 5]), truncated: false });
    const tail = store.tail(4);
    expect([...tail.audio]).toEqual([2, 3, 4, 5]);
    expect(tail.truncated).toBe(true);
    expect(store.length).toBe(5);
  });
});
