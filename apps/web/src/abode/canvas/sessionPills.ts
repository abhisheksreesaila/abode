import type { SidebarThreadSummary } from "../../types";
import { deriveWorkspaceThreadState } from "../shell/threadState";
import { threadShellKey } from "../shell/workspaceModel";

/** Model colours (spec section 7); anything else is neutral ink. */
export type ProviderKey = "claude" | "codex" | "pi" | "gemini" | "other";

export function providerKey(driver: string | undefined): ProviderKey {
  if (driver === "claudeAgent") return "claude";
  if (driver === "codex" || driver === "pi" || driver === "gemini") return driver;
  return "other";
}

export interface SessionPill {
  readonly key: string;
  readonly environmentId: SidebarThreadSummary["environmentId"];
  readonly threadId: SidebarThreadSummary["id"];
  readonly title: string;
  /** The session's model, then the model of each live subagent it delegated to. */
  readonly dots: ReadonlyArray<ProviderKey>;
  readonly pair: boolean;
  /** Only when the session needs the user, is stuck or landed unseen; running sessions say nothing. */
  readonly status: "waiting on you" | "blocked" | "landed" | null;
}

export interface SessionPills {
  readonly pills: ReadonlyArray<SessionPill>;
  /** Visited idle or finished sessions: the "N done" fold. */
  readonly done: ReadonlyArray<SessionPill>;
  readonly doneCount: number;
}

/**
 * Live: running, waiting, blocked, finished but not yet looked at ("landed"), or never run.
 * Only visited idle or finished sessions go to the fold.
 */
export function sessionPills(
  threads: ReadonlyArray<SidebarThreadSummary>,
  input: {
    readonly subagentsByParentKey: ReadonlyMap<string, ReadonlyArray<SidebarThreadSummary>>;
    readonly visitedAt: (thread: SidebarThreadSummary) => string | undefined;
    readonly driverOf: (thread: SidebarThreadSummary) => string | undefined;
  },
): SessionPills {
  const pills: SessionPill[] = [];
  const done: SessionPill[] = [];
  for (const thread of threads) {
    const key = threadShellKey(thread);
    const state = deriveWorkspaceThreadState(thread, input.visitedAt(thread));
    const children = input.subagentsByParentKey.get(key) ?? [];
    const pill: SessionPill = {
      key,
      environmentId: thread.environmentId,
      threadId: thread.id,
      title: thread.title,
      dots: [thread, ...children].map((member) => providerKey(input.driverOf(member))),
      pair: children.length > 0,
      status:
        state.attention === "needs-you"
          ? "waiting on you"
          : state.failed
            ? "blocked"
            : state.attention === "done"
              ? "landed"
              : null,
    };
    const neverRun = thread.latestRun === null && state.attention === null;
    const folded = pill.status === null && state.attention === null && !neverRun;
    (folded ? done : pills).push(pill);
  }
  return { pills, done, doneCount: done.length };
}
