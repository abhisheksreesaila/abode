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

export type PlanRowStatus = "not-started" | "in-progress" | "done" | "needs-you" | "waiting";

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
  /** "stopped": every run ended, and at least one failed, was interrupted or cancelled. */
  readonly state: "working" | "needs-you" | "settled" | "stopped";
  readonly stopReason: "failed" | "stopped" | null;
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
const TERMINAL_RUN = new Set(["completed", "interrupted", "failed", "cancelled", "rolled_back"]);
const BAD_RUN = new Set(["failed", "interrupted", "cancelled"]);
const MAIN_AGENT = "main agent";

/** Ticket IDs lead the task ("A-034: ..."). Mid-text they need two digits and a ticket-like prefix. */
const AT_START = /^[A-Z]{1,5}-\d{1,4}\b/;
const MID_TEXT = /(?<![A-Za-z0-9-])([A-Z]{1,5})-(\d{2,4})\b/g;
const NOT_TICKET_PREFIX = new Set(["UTF", "GPT", "SHA", "ISO", "RFC", "AES", "MD", "CVE", "TLS"]);

function ticketOf(text: string): string | null {
  const start = AT_START.exec(text)?.[0];
  if (start !== undefined) return start;
  for (const match of text.matchAll(MID_TEXT)) {
    if (!NOT_TICKET_PREFIX.has(match[1]!)) return match[0];
  }
  return null;
}

const typeOf = (subagent: Pick<PlanTableSubagent, "agentType">) =>
  subagent.agentType?.trim().toLowerCase() || "helper";

function namesTicket(text: string, ticket: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9-])${ticket}(?!\\d)`).test(text);
}

/** "A-034: Review it" -> { id: "A-034", task: "Review it" }; anything else stays whole. */
function splitTicket(text: string): { id: string | null; task: string; ticket: string | null } {
  const ticket = ticketOf(text);
  if (ticket !== null && text.startsWith(ticket)) {
    const task = text.slice(ticket.length).replace(/^[\s:.\-–—)]+/, "");
    if (task.length > 0) return { id: ticket, task, ticket };
  }
  return { id: null, task: text, ticket };
}

/** "reviewer" fits "Review: A-034 ...", "developer" fits "Develop ...". */
function fitsRow(subagent: PlanTableSubagent, rowText: string): boolean {
  const stem = typeOf(subagent).replace(/(er|or|e)$/, "");
  return stem.length >= 4 && rowText.toLowerCase().includes(stem);
}

/**
 * The subagent behind each task. Rows sharing a ticket ID share its subagents: each row
 * takes the one whose type its text names, else the earliest started; the last row takes
 * the latest (so one ticket with a developer then a reviewer shows the reviewer).
 */
function assignOwners(
  steps: ReadonlyArray<PlanTableStep>,
  subagents: ReadonlyArray<PlanTableSubagent>,
): Array<PlanTableSubagent | null> {
  const owners: Array<PlanTableSubagent | null> = steps.map(() => null);
  const rowsByTicket = new Map<string, number[]>();
  steps.forEach((step, index) => {
    const ticket = ticketOf(step.step);
    if (ticket !== null) rowsByTicket.set(ticket, [...(rowsByTicket.get(ticket) ?? []), index]);
  });
  for (const [ticket, indices] of rowsByTicket) {
    const pool = subagents
      .filter((subagent) => namesTicket(`${subagent.title}\n${subagent.prompt}`, ticket))
      .toSorted(
        (left, right) =>
          (left.startedAtMs ?? Number.POSITIVE_INFINITY) -
          (right.startedAtMs ?? Number.POSITIVE_INFINITY),
      );
    indices.forEach((rowIndex, nth) => {
      if (pool.length === 0) return;
      const pick =
        pool.find((subagent) => fitsRow(subagent, steps[rowIndex]!.step)) ??
        (nth === indices.length - 1 ? pool.at(-1)! : pool[0]!);
      pool.splice(pool.indexOf(pick), 1);
      owners[rowIndex] = pick;
    });
  }
  return owners;
}

export function buildPlanTable(input: {
  readonly steps: ReadonlyArray<PlanTableStep>;
  readonly subagents: ReadonlyArray<PlanTableSubagent>;
  readonly messages: ReadonlyArray<PlanTableMessage>;
  readonly batch: ReadonlySet<string>;
  /** Status of every run in the batch. */
  readonly runs: ReadonlyArray<string>;
  /** The question or approval waiting for the user, or null. */
  readonly needsYou: string | null;
}): PlanTable {
  const { steps, subagents, needsYou } = input;
  const done = steps.filter((step) => step.status === "completed").length;
  const owners = assignOwners(steps, subagents);

  const rows: PlanRow[] = steps.map((step, position) => {
    const { id, task } = splitTicket(step.step);
    const owner = owners[position]!;
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
          ? needsYou !== null
            ? "needs-you"
            : "waiting"
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

  const counts = new Map<string, number>();
  for (const subagent of subagents) {
    if (ACTIVE.has(subagent.status))
      counts.set(typeOf(subagent), (counts.get(typeOf(subagent)) ?? 0) + 1);
  }

  const ended =
    input.runs.length > 0 &&
    input.runs.every((status) => TERMINAL_RUN.has(status)) &&
    !subagents.some((subagent) => ACTIVE.has(subagent.status));
  const bad = input.runs.some((status) => BAD_RUN.has(status));
  const state = needsYou !== null ? "needs-you" : !ended ? "working" : bad ? "stopped" : "settled";
  const finalMessage =
    state === "settled" || state === "stopped"
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
    stopReason: state === "stopped" ? (input.runs.includes("failed") ? "failed" : "stopped") : null,
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
