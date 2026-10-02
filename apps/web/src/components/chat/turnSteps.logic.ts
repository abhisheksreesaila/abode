import type { WorkLogEntry } from "../../session-logic";

/** One line of the compact steps list shown in Simple mode. */
export interface TurnStep {
  readonly id: string;
  readonly status: "done" | "running" | "failed";
  /** Text split so inline code can render in the code font. */
  readonly parts: ReadonlyArray<{ readonly text: string; readonly code: boolean }>;
}

const MAX_STEP_CODE_LENGTH = 48;

function splitInlineCode(text: string): TurnStep["parts"] {
  const parts: Array<{ text: string; code: boolean }> = [];
  text.split("`").forEach((segment, index) => {
    if (segment.length > 0) parts.push({ text: segment, code: index % 2 === 1 });
  });
  return parts;
}

function truncate(value: string): string {
  return value.length > MAX_STEP_CODE_LENGTH
    ? `${value.slice(0, MAX_STEP_CODE_LENGTH - 1)}…`
    : value;
}

/**
 * A step reads as "<what happened> <subject>": the tool's own label, then the
 * command or the first file it touched as inline code. Only existing work
 * entry fields, nothing new on the wire.
 */
export function stepFromWorkEntry(entry: WorkLogEntry, failed: boolean): TurnStep {
  const label = (entry.toolTitle ?? entry.label).trim();
  const subject = entry.command?.trim() || entry.changedFiles?.[0]?.trim() || "";
  const text = subject && !label.includes(subject) ? `${label} \`${truncate(subject)}\`` : label;
  const status = failed
    ? "failed"
    : entry.toolLifecycleStatus === "inProgress"
      ? "running"
      : "done";
  return { id: entry.id, status, parts: splitInlineCode(text) };
}

export function deriveTurnSteps(
  entries: ReadonlyArray<WorkLogEntry>,
  isFailed: (entry: WorkLogEntry) => boolean,
): TurnStep[] {
  return entries.map((entry) => stepFromWorkEntry(entry, isFailed(entry)));
}

export function turnStepsEqual(
  a: ReadonlyArray<TurnStep> | undefined,
  b: ReadonlyArray<TurnStep> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((step, index) => {
    const other = b[index]!;
    return (
      step.id === other.id &&
      step.status === other.status &&
      step.parts.length === other.parts.length &&
      step.parts.every(
        (part, i) => part.text === other.parts[i]!.text && part.code === other.parts[i]!.code,
      )
    );
  });
}
