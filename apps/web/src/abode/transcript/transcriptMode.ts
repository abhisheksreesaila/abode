/**
 * Calm reads like a status board: your messages, one "Worked for ..." line per
 * settled turn, and anything that needs you or went wrong. Detailed is
 * upstream's transcript, unchanged. Calm replaced abode's Simple mode, so a
 * stored "simple" still reads as Calm.
 */
export type TranscriptMode = "calm" | "detailed";

export const DEFAULT_TRANSCRIPT_MODE: TranscriptMode = "calm";

export function parseTranscriptMode(value: unknown): TranscriptMode {
  if (value === "detailed") return "detailed";
  if (value === "calm" || value === "simple") return "calm";
  return DEFAULT_TRANSCRIPT_MODE;
}

export function otherTranscriptMode(mode: TranscriptMode): TranscriptMode {
  return mode === "calm" ? "detailed" : "calm";
}
