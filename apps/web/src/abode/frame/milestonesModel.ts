import type { Milestone, MilestoneState, Ticket } from "../canvas/plan/parsePlan";

export type ChipTone = "done" | "progress" | "needs" | "review" | "todo";

/** The ticket's status chip: the agent's status word as the plan file wrote it. */
export function ticketChip(ticket: Ticket): { readonly tone: ChipTone; readonly label: string } {
  if (ticket.review) return { tone: "review", label: "in review" };
  switch (ticket.state) {
    case "done":
      return { tone: "done", label: "done" };
    case "running":
      return { tone: "progress", label: "in progress" };
    case "stopped":
    case "failed":
      return { tone: "needs", label: "needs you" };
    case "todo":
      return { tone: "todo", label: "todo" };
  }
}

const STATE_WORD: Record<MilestoneState, string> = {
  done: "done",
  current: "in progress",
  todo: "next",
};

export function milestoneStateWord(state: MilestoneState): string {
  return STATE_WORD[state];
}

/** An explicit choice wins; otherwise only the milestone in progress is open. */
export function isMilestoneOpen(
  milestone: Pick<Milestone, "key" | "state">,
  chosen: Readonly<Record<string, boolean>> | undefined,
): boolean {
  return chosen?.[milestone.key] ?? milestone.state === "current";
}

/** "M1", "M2"… by position. */
export function milestoneId(index: number): string {
  return `M${index + 1}`;
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function ageLabel(fromMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - fromMs) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
