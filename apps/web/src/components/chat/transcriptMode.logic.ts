import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import { omitSupersededLifecycleMarkers } from "@t3tools/client-runtime/work-log/presentation";
import { workEntryDisplayIndicatesToolFailure } from "../../session-logic";
import { workEntryIsVisibleInGroup, type MessagesTimelineRow } from "./MessagesTimeline.logic";
import { deriveTurnSteps, type TurnStep } from "./turnSteps.logic";

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
  failed: number;
  files: Set<string>;
  steps: TurnStep[];
}

/** Counts the same entries Detailed shows as tool rows, so the summary matches. */
function totalsByTurn(entries: ReadonlyArray<TimelineEntry>) {
  const byTurn = new Map<string, WorkLogEntry[]>();
  for (const entry of entries) {
    if (entry.kind !== "work" || entry.entry.tone !== "tool" || !entry.entry.turnId) continue;
    if (!workEntryIsVisibleInGroup(entry.entry)) continue;
    const list = byTurn.get(entry.entry.turnId);
    if (list) list.push(entry.entry);
    else byTurn.set(entry.entry.turnId, [entry.entry]);
  }
  const totals = new Map<string, TurnWorkTotals>();
  for (const [turnId, list] of byTurn) {
    const kept = omitSupersededLifecycleMarkers(list, (entry) => entry);
    const turn: TurnWorkTotals = {
      toolCalls: 0,
      failed: 0,
      files: new Set(),
      steps: deriveTurnSteps(kept, workEntryDisplayIndicatesToolFailure),
    };
    for (const work of kept) {
      turn.toolCalls += 1;
      if (workEntryDisplayIndicatesToolFailure(work)) turn.failed += 1;
      for (const file of work.changedFiles ?? []) turn.files.add(file);
    }
    totals.set(turnId, turn);
  }
  return totals;
}

export function formatWorkSummary(
  label: string,
  toolCalls: number,
  files: number,
  failed = 0,
): string {
  const parts = [label];
  if (toolCalls > 0) parts.push(`${toolCalls} tool ${toolCalls === 1 ? "call" : "calls"}`);
  if (files > 0) parts.push(`${files} ${files === 1 ? "file" : "files"} edited`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(" \u00b7 ");
}

/**
 * What clicking a "Worked for ..." row does. In Simple it is a doorway: switch
 * to Detailed and keep the turn expanded. In Detailed it toggles the turn.
 */
export function resolveTurnFoldClick(
  mode: TranscriptMode,
  expanded: boolean,
): { switchToDetailed: boolean; expanded: boolean } {
  return mode === "simple"
    ? { switchToDetailed: true, expanded: true }
    : { switchToDetailed: false, expanded: !expanded };
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
        if (!row.hasFailure) continue;
        break;
      case "work": {
        // The expanded details of a kept live or failed group must stay, or its chevron is dead.
        const previous = out.at(-1);
        const detailsOfKept =
          row.isExpandedToolGroup &&
          previous !== undefined &&
          (previous.kind === "work-live" || previous.kind === "work-toggle") &&
          row.id === `${previous.groupId}:details`;
        if (!detailsOfKept && !row.groupedEntries.some(isWorkEntryVisibleInSimple)) continue;
        break;
      }
      case "activity-group":
        if (!row.active) continue;
        break;
      case "turn-fold": {
        const turn = (totals ??= totalsByTurn(entries)).get(row.turnId);
        const label = formatWorkSummary(
          row.label,
          turn?.toolCalls ?? 0,
          turn?.files.size ?? 0,
          turn?.failed ?? 0,
        );
        const steps = turn?.steps.length ? turn.steps : undefined;
        out.push(
          label === row.label && !steps ? row : { ...row, label, ...(steps ? { steps } : {}) },
        );
        continue;
      }
    }
    out.push(row);
  }
  return out;
}
