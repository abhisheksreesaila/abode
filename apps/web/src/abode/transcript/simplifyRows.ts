import {
  workEntryIsVisibleInGroup,
  type MessagesTimelineRow,
} from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";
import { workEntryDisplayIndicatesToolFailure } from "~/session-logic";
import type { TranscriptMode } from "./transcriptMode";

interface RunTotals {
  toolCalls: number;
  failed: number;
  files: Set<string>;
}

/** Counts the entries Detailed shows as tool rows, only for runs that have a fold row. */
function totalsByRun(entries: ReadonlyArray<TimelineEntry>, runIds: ReadonlySet<string>) {
  const totals = new Map<string, RunTotals>();
  for (const entry of entries) {
    if (entry.kind !== "work") continue;
    const work = entry.entry;
    if (work.tone !== "tool" || !work.runId || !runIds.has(work.runId)) continue;
    if (!workEntryIsVisibleInGroup(work)) continue;
    let run = totals.get(work.runId);
    if (!run) totals.set(work.runId, (run = { toolCalls: 0, failed: 0, files: new Set() }));
    run.toolCalls += 1;
    if (workEntryDisplayIndicatesToolFailure(work)) run.failed += 1;
    for (const file of work.changedFiles ?? []) run.files.add(file);
  }
  return totals;
}

function isWorkLogRow(row: MessagesTimelineRow | undefined): boolean {
  return (
    row !== undefined &&
    (row.kind === "work" ||
      row.kind === "work-toggle" ||
      row.kind === "work-live" ||
      row.kind === "thinking")
  );
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
  return parts.join(" · ");
}

/**
 * Simple view of upstream's derived rows. Tool groups drop out, and upstream's
 * own "Worked for ..." fold row (which already hides a settled turn's steps and
 * opens on click) gains call and file counts, so a tools-only turn never looks
 * empty. Live rows (working indicator, running tool) and failures stay. An
 * expanded fold shows its turn exactly as Detailed does.
 */
export function simplifyRowsForMode(
  rows: MessagesTimelineRow[],
  entries: ReadonlyArray<TimelineEntry>,
  mode: TranscriptMode,
): MessagesTimelineRow[] {
  if (mode === "detailed") return rows;
  let totals: Map<string, RunTotals> | undefined;
  let inExpandedFold = false;
  const out: MessagesTimelineRow[] = [];
  for (const row of rows) {
    switch (row.kind) {
      case "message":
        if (row.message.role === "user") inExpandedFold = false;
        break;
      case "turn-fold": {
        inExpandedFold = row.expanded;
        totals ??= totalsByRun(
          entries,
          new Set(rows.flatMap((r) => (r.kind === "turn-fold" ? [r.runId] : []))),
        );
        const run = totals.get(row.runId);
        const label = formatWorkSummary(
          row.label,
          run?.toolCalls ?? 0,
          run?.files.size ?? 0,
          run?.failed ?? 0,
        );
        out.push(label === row.label ? row : { ...row, label });
        continue;
      }
      case "work-toggle":
        if (!inExpandedFold && !row.hasFailure) continue;
        break;
      case "work": {
        if (inExpandedFold) break;
        if (row.isExpandedToolGroup) {
          // The expanded details of a kept group must stay, or its chevron is dead.
          const previous = out.at(-1);
          const keptGroup =
            previous !== undefined &&
            (previous.kind === "work-live" ||
              previous.kind === "work-toggle" ||
              previous.kind === "thinking") &&
            row.id === `${previous.groupId}:details`;
          if (!keptGroup) continue;
        } else if (row.displayLabel !== undefined) {
          // A single tool call: a step, unless it failed.
          if (!row.groupedEntries.some(workEntryDisplayIndicatesToolFailure)) continue;
        }
        // Anything else upstream emits as a plain work row is standalone: provider errors,
        // usage-limit and retry warnings, system notices, notifications, failed-run work.
        break;
      }
    }
    out.push(row);
  }
  // Spacing flag from upstream: a row only continues a work log if its neighbour survived.
  return out.map((row, index) =>
    row.continuesWorkLog && !isWorkLogRow(out[index + 1])
      ? { ...row, continuesWorkLog: false }
      : row,
  );
}
