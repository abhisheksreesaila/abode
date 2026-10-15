import { describe, expect, it } from "vite-plus/test";

import { segmentAudio } from "./segmentAudio";

const RATE = 16_000;
/** Silence kept around the speech of a trimmed segment. */
const PAD = 0.15;

/** Tone with silences: `silences` are [fromSeconds, toSeconds] ranges of zeros. */
function pcm(seconds: number, silences: Array<[number, number]> = []): Float32Array {
  const audio = new Float32Array(seconds * RATE);
  for (let i = 0; i < audio.length; i++) audio[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / RATE);
  for (const [from, to] of silences) audio.fill(0, from * RATE, to * RATE);
  return audio;
}

/** Segment bounds in seconds, rounded to the millisecond. */
function seconds(audio: Float32Array) {
  return segmentAudio(audio).map((s) => [
    Math.round((s.start / RATE) * 1000) / 1000,
    Math.round((s.end / RATE) * 1000) / 1000,
  ]);
}

describe("segmentAudio", () => {
  it("returns one untouched segment for audio that fits in 30 s", () => {
    expect(segmentAudio(pcm(10, [[4, 5]]))).toEqual([{ start: 0, end: 10 * RATE }]);
    expect(segmentAudio(pcm(30))).toEqual([{ start: 0, end: 30 * RATE }]);
  });

  it("cuts at the pause 20 to 25 s in and trims the silence to 0.15 s each side", () => {
    expect(seconds(pcm(50, [[22, 23]]))).toEqual([
      [0, 22 + PAD],
      [23 - PAD, 50],
    ]);
  });

  it("prefers the longest pause inside the 20 to 25 s window", () => {
    expect(
      seconds(
        pcm(50, [
          [21, 21.5],
          [23, 24],
          [14, 15],
        ]),
      )[0],
    ).toEqual([0, 23 + PAD]);
  });

  it("falls back to the latest pause before 30 s when none is in the window", () => {
    expect(
      seconds(
        pcm(60, [
          [12, 13],
          [27, 28],
        ]),
      )[0],
    ).toEqual([0, 27 + PAD]);
  });

  it("cuts hard every 30 s when there is no pause", () => {
    expect(seconds(pcm(70))).toEqual([
      [0, 30],
      [30, 60],
      [60, 70],
    ]);
  });

  it("drops a stretch that is only silence", () => {
    expect(seconds(pcm(100, [[40, 100]]))).toEqual([
      [0, 30],
      [30, 40 + PAD],
    ]);
  });

  it("keeps segments in order, within 30 s, and covering all speech", () => {
    const audio = pcm(130, [
      [22, 23],
      [47, 48.5],
      [75, 76],
      [100, 101],
    ]);
    const segments = segmentAudio(audio);
    expect(segments[0]?.start).toBe(0);
    expect(segments.at(-1)?.end).toBe(audio.length);
    segments.slice(1).forEach((s, i) => expect(s.start).toBeGreaterThanOrEqual(segments[i]!.end));
    for (const s of segments) expect(s.end - s.start).toBeLessThanOrEqual(30 * RATE);
  });
});
