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
 * Mirrors upstream's timelineEntryStartsResponse (not exported) on derived rows:
 * a steer joins its running response; an automatic-wake notification starts one.
 */
function startsResponse(row: MessagesTimelineRow): boolean {
  if (row.kind === "message") {
    const { role, inputIntent } = row.message;
    return role === "user" && inputIntent !== "steer" && inputIntent !== "promoted_queued_to_steer";
  }
  return row.kind === "work" && row.groupedEntries.some((e) => e.itemType === "notification");
}

/**
 * Assistant messages Calm still shows outside an opened fold. Upstream builds a
 * fold row only when a settled turn has something to hide besides its final
 * answer, so a plain text answer has no "Worked for ..." row to open and would
 * be unreachable. Decision: such a turn keeps its last assistant message (and
 * that message's footer) once it has settled; a running turn shows no assistant
 * text at all. Turns with a fold row hide their text; opening the fold shows it.
 * An interrupted or failed turn has no fold either, so it keeps only its last
 * answer on purpose; its earlier steps are in Detailed. Turns split where upstream's
 * response does: a non-steer user message or an automatic-wake notification.
 */
function keptAnswerIds(rows: ReadonlyArray<MessagesTimelineRow>): Set<string> {
  const kept = new Set<string>();
  let start = 0;
  const closeSegment = (end: number) => {
    let hasFold = false;
    let running = false;
    let last: string | undefined;
    for (let i = start; i < end; i++) {
      const row = rows[i]!;
      if (row.kind === "turn-fold") hasFold = true;
      else if (row.kind === "working" || (row.kind === "work-live" && row.active)) running = true;
      else if (row.kind === "message" && row.message.role === "assistant") {
        if (row.assistantCopyStreaming) running = true;
        last = row.message.id;
      }
    }
    if (last !== undefined && !hasFold && !running) kept.add(last);
  };
  rows.forEach((row, index) => {
    if (startsResponse(row)) {
      closeSegment(index);
      start = index + 1;
    }
  });
  closeSegment(rows.length);
  return kept;
}

/**
 * Calm view of upstream's derived rows. Your messages stay. A settled turn
 * shows only upstream's own "Worked for ..." fold row (which gains call and file
 * counts, so a tools-only turn never looks empty); the agent's text, tool groups
 * and thinking drop out. Live rows (working indicator, running tool) and
 * failures stay, but no assistant text streams. An expanded fold shows its turn
 * exactly as Detailed does.
 */
export function simplifyRowsForMode(
  rows: MessagesTimelineRow[],
  entries: ReadonlyArray<TimelineEntry>,
  mode: TranscriptMode,
): MessagesTimelineRow[] {
  if (mode === "detailed") return rows;
  let totals: Map<string, RunTotals> | undefined;
  let inExpandedFold = false;
  const keptAnswers = keptAnswerIds(rows);
  const out: MessagesTimelineRow[] = [];
  for (const row of rows) {
    if (startsResponse(row)) inExpandedFold = false;
    switch (row.kind) {
      case "message":
        if (row.message.role === "assistant" && !inExpandedFold) {
          if (!keptAnswers.has(row.message.id)) continue;
        }
        break;
      case "assistant-meta":
        if (!inExpandedFold && !keptAnswers.has(row.message.id)) continue;
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
          // A single tool call: a step, unless it failed or records an answered question.
          const keep = row.groupedEntries.some(
            (entry) =>
              workEntryDisplayIndicatesToolFailure(entry) || entry.questionAnswer !== undefined,
          );
          if (!keep) continue;
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
