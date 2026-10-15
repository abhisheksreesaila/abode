/**
 * The calm card: what a glance at a thread needs. Tickets come from the agent's own task
 * list; agent rows group the run's subagents by type (A-018 records Claude's
 * `subagent_type`; Codex has none, so its subagents are "helper").
 */

export interface CalmSubagent {
  readonly status:
    | "idle"
    | "pending"
    | "running"
    | "waiting"
    | "completed"
    | "failed"
    | "cancelled"
    | "interrupted";
  readonly agentType?: string | undefined;
}

export interface CalmStep {
  readonly status: "pending" | "inProgress" | "completed";
}

export interface CalmAgentRow {
  readonly type: string;
  readonly emoji: string;
  readonly finished: number;
  readonly started: number;
  /** Every subagent of this type has finished. */
  readonly done: boolean;
}

export interface CalmCard {
  readonly tickets: {
    readonly done: number;
    readonly total: number;
    readonly allDone: boolean;
  } | null;
  readonly agents: ReadonlyArray<CalmAgentRow>;
  /** Types beyond the shown rows. */
  readonly moreAgentTypes: number;
  readonly needsYou: boolean;
}

const MAX_AGENT_ROWS = 6;
const FINISHED = new Set<CalmSubagent["status"]>([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);
const EMOJI: Record<string, string> = {
  developer: "🛠️",
  reviewer: "🔍",
  explore: "🧭",
  plan: "📐",
};
const FALLBACK_EMOJI = "🤖";

export function buildCalmCard(input: {
  readonly steps: ReadonlyArray<CalmStep>;
  readonly subagents: ReadonlyArray<CalmSubagent>;
  readonly needsYou: boolean;
}): CalmCard | null {
  const { steps, subagents, needsYou } = input;
  if (steps.length === 0 && subagents.length === 0 && !needsYou) return null;

  const done = steps.filter((step) => step.status === "completed").length;
  const tickets =
    steps.length === 0 ? null : { done, total: steps.length, allDone: done === steps.length };

  const byType = new Map<string, { finished: number; started: number }>();
  for (const subagent of subagents) {
    const type = subagent.agentType?.trim().toLowerCase() || "helper";
    const counts = byType.get(type) ?? { finished: 0, started: 0 };
    counts.started += 1;
    if (FINISHED.has(subagent.status)) counts.finished += 1;
    byType.set(type, counts);
  }
  const rows = [...byType].map(([type, counts]) => ({
    type,
    emoji: EMOJI[type] ?? FALLBACK_EMOJI,
    ...counts,
    done: counts.finished === counts.started,
  }));

  return {
    tickets,
    agents: rows.slice(0, MAX_AGENT_ROWS),
    moreAgentTypes: Math.max(0, rows.length - MAX_AGENT_ROWS),
    needsYou,
  };
}

/**
 * Which task list and subagents still describe the work in progress. A list stays while it
 * is unfinished, since a wake (a new run) keeps working through it; a finished one leaves
 * once a newer run starts. Subagents likewise stay while any runs. Without this the card
 * would show an old "5 of 5 ✓" under every later question.
 */
export function currentWork<Step extends CalmStep, Subagent extends CalmSubagent>(input: {
  readonly latestRunId: string | null;
  readonly plan: { readonly runId: string | null; readonly steps: ReadonlyArray<Step> } | null;
  readonly turn: {
    readonly runId: string | null;
    readonly subagents: ReadonlyArray<Subagent>;
  } | null;
}): { readonly steps: ReadonlyArray<Step>; readonly subagents: ReadonlyArray<Subagent> } {
  const { latestRunId, plan, turn } = input;
  const planCurrent =
    plan !== null &&
    (plan.runId === latestRunId || plan.steps.some((step) => step.status !== "completed"));
  const turnCurrent =
    turn !== null &&
    (turn.runId === latestRunId ||
      turn.subagents.some((subagent) => !FINISHED.has(subagent.status)));
  return {
    steps: planCurrent ? plan.steps : [],
    subagents: turnCurrent ? turn.subagents : [],
  };
}
