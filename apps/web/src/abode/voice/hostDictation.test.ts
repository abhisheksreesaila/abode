import type { VoiceSessionInput, VoiceSessionResult } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  CHUNK_SAMPLES,
  HOST_FINISH_TIMEOUT_MS,
  createHostDictation,
  floatToPcm16,
  textFromHostOrBrowser,
  type VoiceCall,
} from "./hostDictation";

/** A host that records what it was asked and answers like the real one. */
function fakeHost(options: { text?: string; failAudioSeq?: number; failStart?: boolean } = {}) {
  const requests: VoiceSessionInput[] = [];
  const received = new Map<number, Uint8Array>();
  const call: VoiceCall = async (input) => {
    requests.push(input);
    await Promise.resolve();
    switch (input.op) {
      case "start":
        if (options.failStart) throw new Error("busy");
        return { op: "started", sessionId: "s1" };
      case "audio":
        if (input.seq === options.failAudioSeq) throw new Error("session closed");
        received.set(input.seq, input.pcm);
        return { op: "ok" };
      case "finish":
        return { op: "text", text: options.text ?? "hello world" };
      default:
        return { op: "ok" } satisfies VoiceSessionResult;
    }
  };
  return { call, requests, received };
}

const ops = (requests: VoiceSessionInput[]) => requests.map((request) => request.op);
const seconds = (n: number) => new Float32Array(n * 16_000).fill(0.5);

describe("floatToPcm16", () => {
  it("encodes little-endian 16-bit samples with the extremes clamped", () => {
    const bytes = floatToPcm16(Float32Array.of(0, 0.5, -0.5, 1, -1, 2));
    const view = new DataView(bytes.buffer);
    expect([0, 1, 2, 3, 4, 5].map((index) => view.getInt16(index * 2, true))).toEqual([
      0, 16384, -16384, 32767, -32768, 32767,
    ]);
  });
});

describe("createHostDictation", () => {
  it("sends 200 ms chunks in order, then the rest, then asks for the text with the chunk count", async () => {
    const host = fakeHost({ text: "fix the websocket" });
    const dictation = createHostDictation(host.call);

    // 1.1 s arrives in the odd-sized pieces a microphone produces.
    for (let sent = 0; sent < 17_600; sent += 700) {
      dictation.push(new Float32Array(Math.min(700, 17_600 - sent)).fill(0.25));
    }
    const text = await dictation.finish();

    expect(text).toBe("fix the websocket");
    const audio = host.requests.filter((request) => request.op === "audio");
    expect(audio.map((request) => request.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...host.received.values()].map((pcm) => pcm.byteLength / 2)).toEqual([
      CHUNK_SAMPLES,
      CHUNK_SAMPLES,
      CHUNK_SAMPLES,
      CHUNK_SAMPLES,
      CHUNK_SAMPLES,
      17_600 - 5 * CHUNK_SAMPLES,
    ]);
    expect(host.requests[0]).toEqual({ op: "start" });
    expect(host.requests.at(-1)).toEqual({ op: "finish", sessionId: "s1", chunks: 6 });
  });

  it("holds audio captured before the host answered start and sends it afterwards", async () => {
    const host = fakeHost();
    const dictation = createHostDictation(host.call);
    dictation.push(seconds(1));
    await dictation.finish();

    expect(ops(host.requests)[0]).toBe("start");
    expect(host.received.size).toBe(5);
  });

  it("never sends audio for a dictation that was cancelled, and tells the host", async () => {
    const host = fakeHost();
    const dictation = createHostDictation(host.call);
    dictation.push(seconds(1));
    dictation.cancel();
    dictation.cancel();
    dictation.push(seconds(1));
    await Promise.resolve();
    await Promise.resolve();

    expect(host.requests.filter((request) => request.op === "audio")).toEqual([]);
    expect(host.requests.filter((request) => request.op === "cancel")).toEqual([
      { op: "cancel", sessionId: "s1" },
    ]);
  });

  it("rejects finish when the host refuses to start", async () => {
    const dictation = createHostDictation(fakeHost({ failStart: true }).call);
    dictation.push(seconds(1));
    await expect(dictation.finish()).rejects.toThrow("busy");
  });

  it("rejects finish when a chunk is refused, without asking for the text", async () => {
    const host = fakeHost({ failAudioSeq: 2 });
    const dictation = createHostDictation(host.call);
    dictation.push(seconds(2));
    await expect(dictation.finish()).rejects.toThrow("session closed");
    expect(ops(host.requests)).not.toContain("finish");
  });
});

describe("textFromHostOrBrowser", () => {
  it("uses the host's text, with the developer vocabulary applied", async () => {
    const host = fakeHost({ text: "open the work tree in sq lite" });
    const dictation = createHostDictation(host.call);
    dictation.push(seconds(1));
    let browserRuns = 0;

    const text = await textFromHostOrBrowser(dictation, async () => {
      browserRuns += 1;
      return "browser";
    });

    expect(text).toBe("open the worktree in SQLite");
    expect(browserRuns).toBe(0);
  });

  it("falls back to the browser when the host fails", async () => {
    const dictation = createHostDictation(fakeHost({ failStart: true }).call);
    dictation.push(seconds(1));
    expect(await textFromHostOrBrowser(dictation, async () => "from the browser")).toBe(
      "from the browser",
    );
  });

  it("goes straight to the browser when there is no host dictation", async () => {
    expect(await textFromHostOrBrowser(null, async () => "from the browser")).toBe(
      "from the browser",
    );
  });
});

describe("a dictation that is cancelled or stuck", () => {
  it("does not hand a cancelled recording to the browser when Esc arrives during finish", async () => {
    const host = fakeHost();
    const dictation = createHostDictation(host.call);
    dictation.push(seconds(1));
    let current = true;
    let browserRuns = 0;

    const result = textFromHostOrBrowser(
      dictation,
      async () => {
        browserRuns += 1;
        return "browser";
      },
      () => current,
    );
    current = false;
    dictation.cancel();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(browserRuns).toBe(0);
  });

  it("falls back to the browser when the host never answers, about 10 s after finish", async () => {
    vi.useFakeTimers();
    try {
      const call: VoiceCall = () => new Promise(() => undefined);
      const dictation = createHostDictation(call);
      dictation.push(seconds(1));
      const text = textFromHostOrBrowser(dictation, async () => "from the browser");
      await vi.advanceTimersByTimeAsync(HOST_FINISH_TIMEOUT_MS);
      expect(await text).toBe("from the browser");
    } finally {
      vi.useRealTimers();
    }
  });
});
