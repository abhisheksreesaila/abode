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
 * The runs of the current batch: the user's latest run plus every wake run after it (a
 * background subagent finishing, a delegated result). Wake runs carry `workStartedAt`;
 * a run the user started does not.
 */
export function batchRunIds(
  runs: ReadonlyArray<{
    readonly id: string;
    readonly ordinal: number;
    readonly workStartedAt?: unknown;
  }>,
): Set<string> {
  const ids = new Set<string>();
  const newestFirst = runs.toSorted((left, right) => right.ordinal - left.ordinal);
  for (const run of newestFirst) {
    ids.add(run.id);
    if (run.workStartedAt === undefined) break;
  }
  return ids;
}

/**
 * The task list and subagents of the current batch, so the card counts a whole batch of
 * developers across the wakes they cause, and an old list never lingers under later work.
 */
export function currentWork<Step extends CalmStep, Subagent extends CalmSubagent>(input: {
  readonly batch: ReadonlySet<string>;
  readonly plan: { readonly runId: string | null; readonly steps: ReadonlyArray<Step> } | null;
  readonly subagents: ReadonlyArray<Subagent & { readonly runId: string | null }>;
}): { readonly steps: ReadonlyArray<Step>; readonly subagents: ReadonlyArray<Subagent> } {
  const { batch, plan } = input;
  const inBatch = (runId: string | null) => runId !== null && batch.has(runId);
  return {
    steps: plan !== null && inBatch(plan.runId) ? plan.steps : [],
    subagents: input.subagents.filter((subagent) => inBatch(subagent.runId)),
  };
}
