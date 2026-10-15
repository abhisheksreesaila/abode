import { describe, expect, it } from "vite-plus/test";

import { transcribeSegments } from "./transcribeSegments";

const RATE = 16_000;

/** Square-wave "speech" with no pauses, so a 70 s clip splits into 30 + 30 + 10 s. */
function speech(seconds: number): Float32Array {
  return Float32Array.from({ length: seconds * RATE }, (_, i) =>
    Math.floor(i / 20) % 2 === 0 ? 0.5 : -0.5,
  );
}

describe("transcribeSegments", () => {
  it("joins the text of every segment and reports each one before it starts", async () => {
    const lengths: number[] = [];
    const progress: Array<[number, number]> = [];
    const text = await transcribeSegments(
      speech(70),
      async (segment) => {
        lengths.push(segment.length / RATE);
        return ` part ${lengths.length} `;
      },
      { isCancelled: () => false, onSegment: (current, total) => progress.push([current, total]) },
    );
    expect(text).toBe("part 1 part 2 part 3");
    expect(lengths).toEqual([30, 30, 10]);
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("stops after a cancel: later segments never reach the recognizer", async () => {
    let calls = 0;
    let cancelled = false;
    const text = await transcribeSegments(
      speech(70),
      async () => {
        calls += 1;
        cancelled = true; // the user cancels while the first segment is being recognized
        return "x";
      },
      { isCancelled: () => cancelled, onSegment: () => {} },
    );
    expect(text).toBeNull();
    expect(calls).toBe(1);
  });

  it("does not start at all when already cancelled", async () => {
    let calls = 0;
    const text = await transcribeSegments(
      speech(5),
      async () => {
        calls += 1;
        return "x";
      },
      { isCancelled: () => true, onSegment: () => {} },
    );
    expect(text).toBeNull();
    expect(calls).toBe(0);
  });

  it("reports no segment progress for a recording of 30 s or less", async () => {
    const progress: Array<[number, number]> = [];
    const text = await transcribeSegments(speech(12), async () => "hello", {
      isCancelled: () => false,
      onSegment: (current, total) => progress.push([current, total]),
    });
    expect(text).toBe("hello");
    expect(progress).toEqual([]);
  });
});
