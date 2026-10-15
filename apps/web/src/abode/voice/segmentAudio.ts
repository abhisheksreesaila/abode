/** Same as SPEECH_SAMPLE_RATE in pcmBuffer.ts; not imported so Node can run this file directly. */
const SPEECH_SAMPLE_RATE = 16_000;

/** Moonshine and Whisper are trained on clips of up to 30 s. */
export const MAX_SEGMENT_SECONDS = 30;
/** Cut at a pause that falls inside this window of the segment when there is one. */
const PREFERRED_WINDOW_SECONDS = [20, 25] as const;
/** With no pause at all, cut at the quietest moment in the last 3 s before the limit. */
const HARD_CUT_WINDOW_SECONDS = 3;
/** Never cut earlier than this, so a segment is never a few words. */
const MIN_SEGMENT_SECONDS = 5;
const FRAME_SECONDS = 0.02;
/** A pause is at least this long. */
const MIN_PAUSE_SECONDS = 0.3;
/**
 * Silence kept around the speech of each segment. Moonshine sometimes returns nothing for a
 * segment that opens with a long stretch of silence, so the cut pause is trimmed to this.
 */
const EDGE_PADDING_SECONDS = 0.15;
/** A final piece shorter than this is joined to the one before it (Moonshine invents text on tiny clips). */
const MIN_TAIL_SECONDS = 1;
/** The joined segment may run this long. */
const MAX_MERGED_SECONDS = MAX_SEGMENT_SECONDS + 1;
/** Digital silence and the quietest rooms: nothing below this rms is speech. */
const ABSOLUTE_SILENCE = 0.002;

export interface Segment {
  /** Sample index, inclusive. */
  start: number;
  /** Sample index, exclusive. */
  end: number;
}

interface Pause {
  /** Middle of the pause, in samples. */
  center: number;
  frames: number;
}

interface Frames {
  /** Loudness (rms) of each 20 ms frame. */
  rms: Float32Array;
  /** True when the frame is quiet compared with the speech around it. */
  silent: boolean[];
}

/**
 * Silent = within 6 dB of the room's noise floor (the 2nd percentile frame), but never above half
 * the level of the loud parts, so continuous speech is not mistaken for silence, and never below
 * the absolute floor. Soft speech well above the noise floor therefore still counts as speech.
 */
function analyzeFrames(audio: Float32Array, frameSize: number): Frames {
  const count = Math.ceil(audio.length / frameSize);
  const rms = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    const from = f * frameSize;
    const to = Math.min(audio.length, from + frameSize);
    let sum = 0;
    for (let i = from; i < to; i++) sum += (audio[i] ?? 0) ** 2;
    rms[f] = Math.sqrt(sum / (to - from));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(count * 0.02)] ?? 0;
  const loud = sorted[Math.floor(count * 0.9)] ?? 0;
  const threshold = Math.max(ABSOLUTE_SILENCE, Math.min(2 * floor, 0.5 * loud));
  return { rms, silent: Array.from(rms, (value) => value < threshold) };
}

function findPauses(silent: boolean[], frameSize: number): Pause[] {
  const minFrames = Math.round(MIN_PAUSE_SECONDS / FRAME_SECONDS);
  const pauses: Pause[] = [];
  let runStart = -1;
  for (let f = 0; f <= silent.length; f++) {
    const isSilent = f < silent.length && silent[f] === true;
    if (isSilent && runStart < 0) runStart = f;
    if (!isSilent && runStart >= 0) {
      if (f - runStart >= minFrames) {
        pauses.push({ center: Math.round(((runStart + f) / 2) * frameSize), frames: f - runStart });
      }
      runStart = -1;
    }
  }
  return pauses;
}

/** End of the quietest frame (the latest one on a tie) that starts in the last 3 s before `limit`. */
function quietestCut(rms: Float32Array, frameSize: number, limit: number, sampleRate: number) {
  const first = Math.ceil((limit - HARD_CUT_WINDOW_SECONDS * sampleRate) / frameSize);
  const last = Math.floor(limit / frameSize) - 1;
  let best = -1;
  for (let f = Math.max(first, 0); f <= last; f++) {
    if (best < 0 || (rms[f] ?? 0) <= (rms[best] ?? 0)) best = f;
  }
  return best < 0 ? limit : Math.min(limit, (best + 1) * frameSize);
}

/** Pulls both ends of a segment in to the speech, leaving a little padding. */
function trimToSpeech(
  segment: Segment,
  silent: boolean[],
  frameSize: number,
  sampleRate: number,
): Segment | null {
  const firstFrame = Math.floor(segment.start / frameSize);
  const lastFrame = Math.ceil(segment.end / frameSize) - 1;
  let first = firstFrame;
  while (first <= lastFrame && silent[first] === true) first++;
  if (first > lastFrame) return null;
  let last = lastFrame;
  while (silent[last] === true) last--;
  const padding = Math.round(EDGE_PADDING_SECONDS * sampleRate);
  return {
    start: Math.max(segment.start, first * frameSize - padding),
    end: Math.min(segment.end, (last + 1) * frameSize + padding),
  };
}

/**
 * Splits a recording into segments of at most 30 s, cutting in the middle of a pause. Prefers
 * the longest pause 20 to 25 s into the segment, else the latest pause before 30 s, else the
 * quietest moment in the last 3 s. Each segment is then trimmed to its speech (plus 0.15 s),
 * segments that are only silence are dropped, and a final piece under 1 s is joined to the one
 * before it (which may then reach 31 s). Audio that already fits comes back as one untouched segment.
 */
export function segmentAudio(audio: Float32Array, sampleRate = SPEECH_SAMPLE_RATE): Segment[] {
  const max = MAX_SEGMENT_SECONDS * sampleRate;
  if (audio.length <= max) return [{ start: 0, end: audio.length }];
  const frameSize = Math.round(FRAME_SECONDS * sampleRate);
  const { rms, silent } = analyzeFrames(audio, frameSize);
  const pauses = findPauses(silent, frameSize);
  const raw: Segment[] = [];
  let start = 0;
  while (audio.length - start > max) {
    const reachable = pauses.filter(
      (p) => p.center - start >= MIN_SEGMENT_SECONDS * sampleRate && p.center - start <= max,
    );
    const [low, high] = PREFERRED_WINDOW_SECONDS;
    const preferred = reachable.filter(
      (p) => p.center - start >= low * sampleRate && p.center - start <= high * sampleRate,
    );
    const longest = (list: Pause[]) => list.reduce((a, b) => (b.frames > a.frames ? b : a));
    const cut =
      preferred.length > 0
        ? longest(preferred).center
        : reachable.length > 0
          ? (reachable[reachable.length - 1] as Pause).center
          : quietestCut(rms, frameSize, start + max, sampleRate);
    raw.push({ start, end: cut });
    start = cut;
  }
  raw.push({ start, end: audio.length });
  const segments = raw.flatMap(
    (segment) => trimToSpeech(segment, silent, frameSize, sampleRate) ?? [],
  );
  const tail = segments[segments.length - 1];
  const before = segments[segments.length - 2];
  if (
    tail &&
    before &&
    tail.end - tail.start < MIN_TAIL_SECONDS * sampleRate &&
    tail.end - before.start <= MAX_MERGED_SECONDS * sampleRate
  ) {
    segments.splice(-2, 2, { start: before.start, end: tail.end });
  }
  return segments;
}
