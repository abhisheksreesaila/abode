import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { startInterimLoop } from "./interimLoop";

const audio = new Float32Array(16_000);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("startInterimLoop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("transcribes on each tick and reports the text", async () => {
    const onText = vi.fn();
    const stop = startInterimLoop({
      intervalMs: 1000,
      snapshot: () => ({ audio, truncated: false }),
      transcribe: async () => " hello ",
      onText,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onText).toHaveBeenCalledWith("hello");
    stop();
  });

  it("skips ticks while a job is in flight, never queueing a second", async () => {
    const first = deferred<string>();
    const transcribe = vi.fn(() => first.promise);
    const stop = startInterimLoop({
      intervalMs: 1000,
      snapshot: () => ({ audio, truncated: false }),
      transcribe,
      onText: () => {},
    });
    await vi.advanceTimersByTimeAsync(3500);
    expect(transcribe).toHaveBeenCalledTimes(1);
    first.resolve("done");
    await vi.advanceTimersByTimeAsync(1000);
    expect(transcribe).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not start a job before there is enough audio", async () => {
    const transcribe = vi.fn(async () => "x");
    const stop = startInterimLoop({
      intervalMs: 1000,
      snapshot: () => null,
      transcribe,
      onText: () => {},
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(transcribe).not.toHaveBeenCalled();
    stop();
  });

  it("marks a windowed result with a leading ellipsis", async () => {
    const onText = vi.fn();
    const stop = startInterimLoop({
      intervalMs: 1000,
      snapshot: () => ({ audio, truncated: true }),
      transcribe: async () => "tail words",
      onText,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onText).toHaveBeenCalledWith("…tail words");
    stop();
  });

  it("drops a result that lands after stop, and ignores failures", async () => {
    const late = deferred<string>();
    const onText = vi.fn();
    const stop = startInterimLoop({
      intervalMs: 1000,
      snapshot: () => ({ audio, truncated: false }),
      transcribe: () => late.promise,
      onText,
    });
    await vi.advanceTimersByTimeAsync(1000);
    stop();
    late.resolve("too late");
    await vi.advanceTimersByTimeAsync(10);
    expect(onText).not.toHaveBeenCalled();

    const failing = startInterimLoop({
      intervalMs: 1000,
      snapshot: () => ({ audio, truncated: false }),
      transcribe: () => Promise.reject(new Error("worker busy")),
      onText,
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(onText).not.toHaveBeenCalled();
    failing();
  });
});
