import type { TimelineEntry } from "../../session-logic";

/**
 * Simple reads like a report: messages, plans, questions, subagent summaries
 * and errors. Detailed is the full transcript, including every tool call and
 * reasoning block.
 */
export type TranscriptMode = "simple" | "detailed";

export const DEFAULT_TRANSCRIPT_MODE: TranscriptMode = "simple";

export function parseTranscriptMode(value: unknown): TranscriptMode {
  return value === "simple" || value === "detailed" ? value : DEFAULT_TRANSCRIPT_MODE;
}

export function isEntryVisibleInSimpleTranscript(entry: TimelineEntry): boolean {
  switch (entry.kind) {
    case "message":
      return entry.message.role !== "reasoning";
    case "proposed-plan":
      return true;
    case "work": {
      const work = entry.entry;
      return (
        work.agentSpawn !== undefined ||
        work.questionAnswer !== undefined ||
        work.sourceActivityKind === "context-compaction" ||
        work.tone === "error"
      );
    }
  }
}

/**
 * Cheap derived selection: Detailed returns the input untouched, and Simple
 * returns the input when nothing is hidden, so downstream memoization keeps
 * working by identity.
 */
export function filterTimelineEntriesForMode(
  entries: ReadonlyArray<TimelineEntry>,
  mode: TranscriptMode,
): ReadonlyArray<TimelineEntry> {
  if (mode === "detailed") return entries;
  const visible = entries.filter(isEntryVisibleInSimpleTranscript);
  return visible.length === entries.length ? entries : visible;
}
