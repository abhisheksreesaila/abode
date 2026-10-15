import { describe, expect, it } from "vite-plus/test";

import { segmentAudio } from "./segmentAudio";

const RATE = 16_000;
/** Silence kept around the speech of a trimmed segment. */
const PAD = 0.15;

type Span = [from: number, to: number];

/** Square wave at constant loudness (rms = amplitude); `silences` are ranges of zeros. */
function pcm(seconds: number, silences: Span[] = [], amplitude = 0.5): Float32Array {
  const audio = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < audio.length; i++)
    audio[i] = Math.floor(i / 20) % 2 === 0 ? amplitude : -amplitude;
  for (const [from, to] of silences) audio.fill(0, from * RATE, to * RATE);
  return audio;
}

/** Overwrites a range with a square wave of another amplitude. */
function level(audio: Float32Array, from: number, to: number, amplitude: number) {
  for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++) {
    audio[i] = Math.floor(i / 20) % 2 === 0 ? amplitude : -amplitude;
  }
}

/** Deterministic noise with the given rms, added in place. */
function addNoise(audio: Float32Array, rms: number) {
  let seed = 99;
  const uniform = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5;
  for (let i = 0; i < audio.length; i++)
    audio[i] = (audio[i] ?? 0) + uniform() * rms * Math.sqrt(12);
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

  it("with no pause, cuts at the quietest moment in the last 3 s before the limit", () => {
    const audio = pcm(70);
    level(audio, 28, 28.1, 0.2);
    level(audio, 56, 56.1, 0.2);
    expect(seconds(audio)).toEqual([
      [0, 28.1],
      [28.1, 56.1],
      [56.1, 70],
    ]);
  });

  it("cuts at 30 s when nothing is quieter", () => {
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

  it("joins a final piece under 1 s to the segment before it", () => {
    expect(seconds(pcm(60.6))).toEqual([
      [0, 30],
      [30, 60.6],
    ]);
  });

  it("drops a silent final piece instead of sending it", () => {
    expect(seconds(pcm(60.6, [[60, 60.6]]))).toEqual([
      [0, 30],
      [30, 60],
    ]);
  });

  it("keeps a soft ending (-24 dB) that follows a pause", () => {
    const audio = pcm(
      48,
      [
        [22, 22.6],
        [40, 40.6],
      ],
      0.3,
    );
    level(audio, 40.6, 48, 0.02);
    addNoise(audio, 0.0003);
    expect(seconds(audio)).toEqual([
      [0, 22 + PAD],
      [22.45, 48],
    ]);
  });

  it.each([15, 10])("still finds the pause with noise mixed in at %i dB SNR", (snr) => {
    const audio = pcm(50, [[22, 22.6]], 0.3);
    addNoise(audio, 0.3 / 10 ** (snr / 20));
    expect(seconds(audio)).toEqual([
      [0, 22 + PAD],
      [22.45, 50],
    ]);
  });

  it("keeps segments in order, within 31 s, and covering all speech", () => {
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
    for (const s of segments) expect(s.end - s.start).toBeLessThanOrEqual(31 * RATE);
  });
});
