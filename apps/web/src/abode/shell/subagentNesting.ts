import type { SidebarThreadSummary } from "../../types";
import { resolveSidebarThreadStatus } from "../../components/Sidebar.logic";

/**
 * Orchestration V2 stores a subagent as an ordinary thread whose lineage points
 * at its parent, so nesting needs nothing but the thread shells the sidebar
 * already holds.
 */
export type SubagentNestingThread = Pick<
  SidebarThreadSummary,
  | "environmentId"
  | "id"
  | "title"
  | "createdAt"
  | "archivedAt"
  | "lineage"
  | "runtime"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
>;

/** Rows shown under a session before the rest collapse into "+N more". */
export const SIDEBAR_SUBAGENT_VISIBLE_LIMIT = 5;

export function subagentParentKey(environmentId: string, threadId: string): string {
  return `${environmentId}:${threadId}`;
}

function isSubagent(thread: SubagentNestingThread): boolean {
  return thread.lineage.relationshipToParent === "subagent";
}

/** Running, or stopped because it needs the user: the two states worth a row. */
function isLiveSubagent(thread: SubagentNestingThread): boolean {
  const status = resolveSidebarThreadStatus(thread);
  return status === "working" || status === "approval" || status === "input";
}

export interface NestedSubagents<T extends SubagentNestingThread> {
  /** Every non-archived thread that is not a subagent, in input order. */
  readonly topLevel: ReadonlyArray<T>;
  /**
   * Live subagents by the key of the top-level thread they belong to. A
   * subagent of a subagent is listed under the nearest top-level ancestor, so
   * the tree is never deeper than one level.
   */
  readonly runningByParentKey: ReadonlyMap<string, ReadonlyArray<T>>;
}

export function nestRunningSubagents<T extends SubagentNestingThread>(
  threads: ReadonlyArray<T>,
): NestedSubagents<T> {
  const byKey = new Map<string, T>();
  for (const thread of threads)
    byKey.set(subagentParentKey(thread.environmentId, thread.id), thread);

  const topLevelOf = (thread: T): T | null => {
    const seen = new Set<string>();
    let current: T = thread;
    while (isSubagent(current)) {
      const parentId = current.lineage.parentThreadId;
      if (parentId === null) return null;
      const key = subagentParentKey(current.environmentId, parentId);
      if (seen.has(key)) return null;
      seen.add(key);
      const parent = byKey.get(key);
      if (parent === undefined) return null;
      current = parent;
    }
    return current;
  };

  const topLevel: T[] = [];
  const running = new Map<string, T[]>();
  for (const thread of threads) {
    if (thread.archivedAt !== null) continue;
    if (!isSubagent(thread)) {
      topLevel.push(thread);
      continue;
    }
    if (!isLiveSubagent(thread)) continue;
    const owner = topLevelOf(thread);
    if (owner === null || owner.archivedAt !== null) continue;
    const key = subagentParentKey(owner.environmentId, owner.id);
    const siblings = running.get(key);
    if (siblings) siblings.push(thread);
    else running.set(key, [thread]);
  }
  for (const siblings of running.values()) {
    siblings.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
  }
  return { topLevel, runningByParentKey: running };
}

export function subagentOverflow<T>(items: ReadonlyArray<T>): {
  readonly shown: ReadonlyArray<T>;
  readonly moreCount: number;
} {
  if (items.length <= SIDEBAR_SUBAGENT_VISIBLE_LIMIT) return { shown: items, moreCount: 0 };
  return {
    shown: items.slice(0, SIDEBAR_SUBAGENT_VISIBLE_LIMIT),
    moreCount: items.length - SIDEBAR_SUBAGENT_VISIBLE_LIMIT,
  };
}
