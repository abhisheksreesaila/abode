import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import type { MessagesTimelineRow } from "./MessagesTimeline.logic";

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

function isWorkEntryVisibleInSimple(work: WorkLogEntry): boolean {
  return (
    work.agentSpawn !== undefined ||
    work.questionAnswer !== undefined ||
    work.sourceActivityKind === "context-compaction" ||
    work.tone === "error"
  );
}

interface TurnWorkTotals {
  toolCalls: number;
  files: Set<string>;
}

function totalsByTurn(entries: ReadonlyArray<TimelineEntry>) {
  const totals = new Map<string, TurnWorkTotals>();
  for (const entry of entries) {
    if (entry.kind !== "work" || entry.entry.tone !== "tool" || !entry.entry.turnId) continue;
    let turn = totals.get(entry.entry.turnId);
    if (!turn) totals.set(entry.entry.turnId, (turn = { toolCalls: 0, files: new Set() }));
    turn.toolCalls += 1;
    for (const file of entry.entry.changedFiles ?? []) turn.files.add(file);
  }
  return totals;
}

export function formatWorkSummary(label: string, toolCalls: number, files: number): string {
  const parts = [label];
  if (toolCalls > 0) parts.push(`${toolCalls} tool ${toolCalls === 1 ? "call" : "calls"}`);
  if (files > 0) parts.push(`${files} ${files === 1 ? "file" : "files"} edited`);
  return parts.join(" \u00b7 ");
}

/**
 * Simple view of derived rows. Tool groups and settled traces drop out, but the
 * existing "Worked for ..." fold row stays, now with call and file counts, so a
 * tools-only turn never looks empty. Live rows (the working indicator, the
 * running tool and the active trace) stay visible.
 */
export function simplifyRowsForMode(
  rows: MessagesTimelineRow[],
  entries: ReadonlyArray<TimelineEntry>,
  mode: TranscriptMode,
): MessagesTimelineRow[] {
  if (mode === "detailed") return rows;
  let totals: Map<string, TurnWorkTotals> | undefined;
  const out: MessagesTimelineRow[] = [];
  for (const row of rows) {
    switch (row.kind) {
      case "work-toggle":
        continue;
      case "work":
        if (!row.groupedEntries.some(isWorkEntryVisibleInSimple)) continue;
        break;
      case "activity-group":
        if (!row.active) continue;
        break;
      case "turn-fold": {
        const turn = (totals ??= totalsByTurn(entries)).get(row.turnId);
        const label = formatWorkSummary(row.label, turn?.toolCalls ?? 0, turn?.files.size ?? 0);
        out.push(label === row.label ? row : { ...row, label });
        continue;
      }
    }
    out.push(row);
  }
  return out;
}
