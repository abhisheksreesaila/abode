import { segmentAudio } from "./segmentAudio";

export interface TranscribeSegmentsOptions {
  /** Checked before every segment; true stops the loop without starting another one. */
  isCancelled: () => boolean;
  /** Called before each segment of a multi-segment recording, counting from 1. */
  onSegment: (current: number, total: number) => void;
}

/**
 * Transcribes a recording piece by piece (see segmentAudio.ts) and joins the text. Resolves to
 * null when cancelled, so no later segment is ever sent to the model.
 */
export async function transcribeSegments(
  audio: Float32Array,
  recognize: (segment: Float32Array) => Promise<string>,
  options: TranscribeSegmentsOptions,
): Promise<string | null> {
  const segments = segmentAudio(audio);
  const parts: string[] = [];
  for (const [index, { start, end }] of segments.entries()) {
    if (options.isCancelled()) return null;
    if (segments.length > 1) options.onSegment(index + 1, segments.length);
    parts.push(await recognize(audio.subarray(start, end)));
  }
  if (options.isCancelled()) return null;
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
