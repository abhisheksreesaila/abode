/**
 * Calm's plan table (A-033): the agent's own task list as rows, who is working each one,
 * and, once the batch settles, the model's final message. Pure: the component feeds it
 * plain values. Tickets come from the task list; a subagent belongs to a ticket when its
 * title or prompt names the ticket's ID. Codex records no `agentType`, so its subagents
 * are "helper".
 */

export type PlanTableSubagentStatus =
  | "idle"
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export interface PlanTableStep {
  readonly step: string;
  readonly status: "pending" | "inProgress" | "completed";
  readonly durationMs?: number | undefined;
}

export interface PlanTableSubagent {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly agentType?: string | undefined;
  readonly status: PlanTableSubagentStatus;
  readonly startedAtMs: number | null;
  readonly completedAtMs: number | null;
}

export interface PlanTableMessage {
  readonly role: string;
  readonly runId: string | null;
  readonly text: string;
  readonly streaming: boolean;
}

export type PlanRowStatus = "not-started" | "in-progress" | "done" | "needs-you";

export interface PlanRow {
  /** Position in the task list: tasks have no ID of their own. */
  readonly key: string;
  /** The ticket ID when the task text starts with one (it is split off the task). */
  readonly id: string | null;
  readonly task: string;
  readonly status: PlanRowStatus;
  readonly who: string;
  readonly durationMs: number | null;
}

export interface PlanTable {
  readonly state: "working" | "needs-you" | "settled";
  /** Settled with every task done. */
  readonly complete: boolean;
  readonly progress: {
    readonly done: number;
    readonly total: number;
    readonly percent: number;
  } | null;
  readonly agentsRunning: ReadonlyArray<{ readonly type: string; readonly count: number }>;
  readonly needsYou: string | null;
  readonly rows: ReadonlyArray<PlanRow>;
  readonly finalMessage: string | null;
}

const ACTIVE = new Set<PlanTableSubagentStatus>(["pending", "running", "waiting"]);
const TICKET = /\b[A-Z]{1,5}-\d{1,4}\b/;
const MAIN_AGENT = "main agent";

const typeOf = (subagent: Pick<PlanTableSubagent, "agentType">) =>
  subagent.agentType?.trim().toLowerCase() || "helper";

function namesTicket(text: string, ticket: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9-])${ticket}(?!\\d)`).test(text);
}

/** "A-034: Review it" -> { id: "A-034", task: "Review it" }; anything else stays whole. */
function splitTicket(text: string): { id: string | null; task: string; ticket: string | null } {
  const ticket = TICKET.exec(text)?.[0] ?? null;
  if (ticket !== null && text.startsWith(ticket)) {
    const task = text.slice(ticket.length).replace(/^[\s:.\-–—)]+/, "");
    if (task.length > 0) return { id: ticket, task, ticket };
  }
  return { id: null, task: text, ticket };
}

/** The subagent started last (one not yet started counts as latest) among those naming the ticket. */
function latestFor(ticket: string, subagents: ReadonlyArray<PlanTableSubagent>) {
  let latest: PlanTableSubagent | null = null;
  for (const subagent of subagents) {
    if (!namesTicket(`${subagent.title}\n${subagent.prompt}`, ticket)) continue;
    const at = subagent.startedAtMs ?? Number.POSITIVE_INFINITY;
    if (latest === null || at >= (latest.startedAtMs ?? Number.POSITIVE_INFINITY))
      latest = subagent;
  }
  return latest;
}

export function buildPlanTable(input: {
  readonly steps: ReadonlyArray<PlanTableStep>;
  readonly subagents: ReadonlyArray<PlanTableSubagent>;
  readonly messages: ReadonlyArray<PlanTableMessage>;
  readonly batch: ReadonlySet<string>;
  /** Every run of the batch has finished. */
  readonly runsSettled: boolean;
  /** The question or approval waiting for the user, or null. */
  readonly needsYou: string | null;
}): PlanTable {
  const { steps, subagents, needsYou } = input;
  const done = steps.filter((step) => step.status === "completed").length;

  const rows: PlanRow[] = steps.map((step, position) => {
    const { id, task, ticket } = splitTicket(step.step);
    const owner = ticket === null ? null : latestFor(ticket, subagents);
    const duration =
      owner?.startedAtMs != null && owner.completedAtMs != null
        ? Math.max(0, owner.completedAtMs - owner.startedAtMs)
        : owner === null
          ? (step.durationMs ?? null)
          : null;
    const status: PlanRowStatus =
      step.status === "completed"
        ? "done"
        : owner?.status === "waiting"
          ? "needs-you"
          : step.status === "inProgress"
            ? "in-progress"
            : "not-started";
    return {
      key: String(position),
      id,
      task,
      status,
      who: owner === null ? MAIN_AGENT : typeOf(owner),
      durationMs: duration,
    };
  });
  if (needsYou !== null && !rows.some((row) => row.status === "needs-you")) {
    const first = rows.findIndex((row) => row.status === "in-progress");
    if (first >= 0) rows[first] = { ...rows[first]!, status: "needs-you" };
  }

  const counts = new Map<string, number>();
  for (const subagent of subagents) {
    if (ACTIVE.has(subagent.status))
      counts.set(typeOf(subagent), (counts.get(typeOf(subagent)) ?? 0) + 1);
  }

  const settled = input.runsSettled && !subagents.some((subagent) => ACTIVE.has(subagent.status));
  const state = needsYou !== null ? "needs-you" : settled ? "settled" : "working";
  const finalMessage =
    state === "settled"
      ? (input.messages.findLast(
          (message) =>
            message.role === "assistant" &&
            !message.streaming &&
            message.runId !== null &&
            input.batch.has(message.runId) &&
            message.text.trim().length > 0,
        )?.text ?? null)
      : null;

  return {
    state,
    complete: state === "settled" && steps.length > 0 && done === steps.length,
    progress:
      steps.length === 0
        ? null
        : { done, total: steps.length, percent: Math.round((done / steps.length) * 100) },
    agentsRunning: [...counts].map(([type, count]) => ({ type, count })),
    needsYou,
    rows,
    finalMessage,
  };
}

/** "45s", "12m", "1h 12m", like the design's Time column. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 60)}h ${rest}m`;
}

/**
 * The runs of the current batch: the user's latest run plus every wake run after it (a
 * background subagent finishing, a delegated result). Wake runs carry `workStartedAt`;
 * a run the user started does not. A run that never started is skipped unless it is about
 * to: the stamp lands only when a wake starts, so a queued wake (or a queued message later
 * turned into a steer, which cancels its run) would otherwise end the batch.
 */
export function batchRunIds(
  runs: ReadonlyArray<{
    readonly id: string;
    readonly ordinal: number;
    readonly status: string;
    readonly startedAt: unknown;
    readonly workStartedAt?: unknown;
  }>,
): Set<string> {
  const ids = new Set<string>();
  const newestFirst = runs
    .filter(
      (run) => run.startedAt !== null || run.status === "preparing" || run.status === "starting",
    )
    .toSorted((left, right) => right.ordinal - left.ordinal);
  for (const run of newestFirst) {
    ids.add(run.id);
    if (run.workStartedAt === undefined) break;
  }
  return ids;
}

/**
 * The task list and subagents of the current batch, so the table counts a whole batch of
 * developers across the wakes they cause, and an old list never lingers under later work.
 */
export function currentWork<
  Step extends PlanTableStep,
  Subagent extends { readonly status: PlanTableSubagentStatus },
>(input: {
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
