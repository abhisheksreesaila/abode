/**
 * The Control room's Workspaces table as plain data (docs/briefs/control-room.md).
 * `useControlRoomRows` gathers the inputs; nothing here touches React or stores.
 */
import type { WorkspaceThreadState } from "../shell/workspaceList";

export type WorkspaceStatus = "needs-you" | "failed" | "running" | "done" | "idle";

/** What a workspace's session row already knows from its thread shell. */
export interface SessionSummary {
  /** Upstream's scoped thread key. */
  readonly key: string;
  readonly environmentId: string;
  readonly environmentLabel: string;
  readonly state: WorkspaceThreadState;
  /** ISO time of the last user message or update. */
  readonly activityAt: string;
  /** Live subagents under this session. */
  readonly runningSubagents: number;
}

/** What only the thread projection knows, read for running and needs-you sessions. */
export interface SessionDetail {
  /** The agent's task list: steps done of total, or null when it keeps none. */
  readonly progress: { readonly done: number; readonly total: number } | null;
  /** The waiting question, or null. */
  readonly question: string | null;
}

export interface WorkspaceInput {
  readonly key: string;
  readonly name: string;
  readonly sessions: ReadonlyArray<SessionSummary>;
}

export interface WorkspaceRow {
  readonly key: string;
  readonly name: string;
  readonly status: WorkspaceStatus;
  readonly progress: {
    readonly done: number;
    readonly total: number;
    readonly percent: number;
    /** Bar colour: green at 100%, amber otherwise. */
    readonly tone: "working" | "done";
  } | null;
  readonly agents: number;
  /** Environment labels, once each. */
  readonly machines: ReadonlyArray<string>;
  readonly environmentIds: ReadonlyArray<string>;
  readonly activityAt: string | null;
  readonly question: string | null;
  /** The session a click opens: needs-you, else running, else the most recent. */
  readonly openSessionKey: string | null;
}

/**
 * When a session last did something: a live session counts its latest update, an idle one
 * the last user message (a bookkeeping update to an old session is not activity).
 */
export function sessionActivityAt(
  state: WorkspaceThreadState,
  times: {
    readonly latestUserMessageAt: string | null;
    readonly updatedAt: string;
    readonly runtimeUpdatedAt?: string | null;
    readonly createdAt: string;
  },
): string {
  if (!needsSessionDetail(state)) {
    return times.latestUserMessageAt ?? times.updatedAt ?? times.createdAt;
  }
  return [times.latestUserMessageAt, times.updatedAt, times.runtimeUpdatedAt, times.createdAt]
    .filter((time): time is string => typeof time === "string")
    .reduce((latest, time) => (time > latest ? time : latest));
}

/** Only these sessions are worth a projection subscription. */
export function needsSessionDetail(state: WorkspaceThreadState): boolean {
  return state.attention === "running" || state.attention === "needs-you";
}

function sessionStatus(state: WorkspaceThreadState): WorkspaceStatus {
  if (state.attention === "needs-you") return "needs-you";
  if (state.attention === "running") return "running";
  if (state.failed) return "failed";
  if (state.attention === "done") return "done";
  return "idle";
}

/** A workspace shows its most pressing session status; live work outranks an old failure. */
const STATUS_RANK: Record<WorkspaceStatus, number> = {
  "needs-you": 0,
  running: 1,
  failed: 2,
  done: 3,
  idle: 4,
};

function mostRecent(sessions: ReadonlyArray<SessionSummary>): SessionSummary | null {
  return sessions.reduce<SessionSummary | null>(
    (best, session) => (best === null || session.activityAt > best.activityAt ? session : best),
    null,
  );
}

function buildRow(
  workspace: WorkspaceInput,
  details: ReadonlyMap<string, SessionDetail>,
): WorkspaceRow {
  const { sessions } = workspace;
  const statuses = sessions.map((session) => sessionStatus(session.state));
  const status = statuses.reduce<WorkspaceStatus>(
    (top, next) => (STATUS_RANK[next] < STATUS_RANK[top] ? next : top),
    "idle",
  );

  const active = sessions.filter((session) => needsSessionDetail(session.state));
  const lists = active.flatMap((session) => details.get(session.key)?.progress ?? []);
  const done = lists.reduce((sum, list) => sum + list.done, 0);
  const total = lists.reduce((sum, list) => sum + list.total, 0);

  const waiting = sessions.filter((session) => session.state.attention === "needs-you");
  const running = sessions.filter((session) => session.state.attention === "running");
  const openSession = mostRecent(waiting) ?? mostRecent(running) ?? mostRecent(sessions);

  const machines = new Map<string, string>();
  for (const session of sessions) machines.set(session.environmentId, session.environmentLabel);

  return {
    key: workspace.key,
    name: workspace.name,
    status,
    progress:
      total === 0
        ? null
        : {
            done,
            total,
            percent: Math.round((done / total) * 100),
            tone: done === total ? "done" : "working",
          },
    agents: running.length + sessions.reduce((sum, session) => sum + session.runningSubagents, 0),
    machines: [...machines.values()],
    environmentIds: [...machines.keys()],
    activityAt: mostRecent(sessions)?.activityAt ?? null,
    question:
      status === "needs-you" && openSession !== null
        ? (details.get(openSession.key)?.question ?? null)
        : null,
    openSessionKey: openSession?.key ?? null,
  };
}

/** One row per workspace; "Needs you" rows first, the rest in the given order. */
export function buildWorkspaceRows(
  workspaces: ReadonlyArray<WorkspaceInput>,
  details: ReadonlyMap<string, SessionDetail>,
): WorkspaceRow[] {
  const rows = workspaces.map((workspace) => buildRow(workspace, details));
  return [
    ...rows.filter((row) => row.status === "needs-you"),
    ...rows.filter((row) => row.status !== "needs-you"),
  ];
}

const SUMMARY_ORDER: ReadonlyArray<readonly [WorkspaceStatus, string]> = [
  ["needs-you", "needs you"],
  ["running", "running"],
  ["done", "done"],
  ["idle", "idle"],
  ["failed", "failed"],
];

/** `1 needs you · 3 running · 3 idle · 1 failed`, leaving out zeros. */
export function summarizeRows(rows: ReadonlyArray<WorkspaceRow>): string {
  return SUMMARY_ORDER.flatMap(([status, label]) => {
    const count = rows.filter((row) => row.status === status).length;
    return count > 0 ? [`${count} ${label}`] : [];
  }).join(" · ");
}
