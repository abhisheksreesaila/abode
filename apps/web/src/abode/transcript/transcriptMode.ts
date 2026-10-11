/**
 * Simple reads like a report: messages, questions, approvals, errors, and one
 * summary line per turn. Detailed is upstream's transcript, unchanged.
 */
export type TranscriptMode = "simple" | "detailed";

export const DEFAULT_TRANSCRIPT_MODE: TranscriptMode = "simple";

export function parseTranscriptMode(value: unknown): TranscriptMode {
  return value === "simple" || value === "detailed" ? value : DEFAULT_TRANSCRIPT_MODE;
}

export function otherTranscriptMode(mode: TranscriptMode): TranscriptMode {
  return mode === "simple" ? "detailed" : "simple";
}
