/**
 * Pure logic for the abode workspace list: the status pill, the status square
 * tone, a session's place and the "N older" window. No React here.
 */

export type WorkspacePillKind = "needs-you" | "failed" | "running" | "done";

export interface WorkspacePill {
  readonly kind: WorkspacePillKind;
  readonly count: number;
  /** `2 running`, `1 needs you`, `failed`. */
  readonly label: string;
  /** Every non-zero bucket, for the tooltip. */
  readonly detail: string;
}

export type ThreadAttention = "needs-you" | "running" | "done" | null;

export interface WorkspaceThreadState {
  /** What the thread asks of the user right now, from upstream's typed thread status. */
  readonly attention: ThreadAttention;
  /** The thread's last run failed (or hit a usage limit). */
  readonly failed: boolean;
}

function describeBucket(kind: WorkspacePillKind, count: number): string {
  if (kind === "running") return `${count} running`;
  if (kind === "needs-you") return `${count} needs you`;
  if (kind === "done") return "done";
  return count === 1 ? "failed" : `${count} failed`;
}

/**
 * The one pill a workspace header shows, so it fits a narrow sidebar and stays
 * visible collapsed. Attention outranks failure, which outranks running; unseen completions come last.
 */
export function resolveWorkspacePill(
  threads: readonly WorkspaceThreadState[],
): WorkspacePill | null {
  const counts: Record<WorkspacePillKind, number> = {
    "needs-you": 0,
    failed: 0,
    running: 0,
    done: 0,
  };
  for (const thread of threads) {
    if (thread.attention === "needs-you") {
      counts["needs-you"] += 1;
    } else if (thread.attention === "running") {
      counts.running += 1;
    } else if (thread.failed) {
      counts.failed += 1;
    } else if (thread.attention === "done") {
      counts.done += 1;
    }
  }
  const order: WorkspacePillKind[] = ["needs-you", "failed", "running", "done"];
  const top = order.find((kind) => counts[kind] > 0);
  if (top === undefined) return null;
  return {
    kind: top,
    count: counts[top],
    label: describeBucket(top, counts[top]),
    detail: order
      .filter((kind) => counts[kind] > 0)
      .map((kind) => describeBucket(kind, counts[kind]))
      .join(", "),
  };
}

export const LATEST_THREAD_COUNT = 2;

export interface ThreadListWindow<T> {
  readonly shown: readonly T[];
  readonly olderCount: number;
  /** "+N older" is offered: collapsed and something is hidden. */
  readonly showMore: boolean;
  /** "Show less" is offered: expanded and there is more than the latest two. */
  readonly showLess: boolean;
}

/**
 * The threads a workspace lists: its latest two (plus the active thread, which is
 * never hidden), or all of them once expanded. Rendering and the keyboard jump
 * order both read this, so they cannot disagree.
 */
export function threadListWindow<T>(
  threads: readonly T[],
  options: {
    readonly expanded: boolean;
    readonly isActive?: (thread: T) => boolean;
    readonly latest?: number;
  },
): ThreadListWindow<T> {
  const latest = options.latest ?? LATEST_THREAD_COUNT;
  const split = splitLatestThreads(threads, {
    latest,
    ...(options.isActive ? { isActive: options.isActive } : {}),
  });
  return {
    shown: options.expanded ? threads : split.shown,
    olderCount: split.olderCount,
    showMore: !options.expanded && split.olderCount > 0,
    showLess: options.expanded && threads.length > latest,
  };
}

/**
 * The latest two threads plus the "+N older" count. The active thread is never
 * hidden behind "+N older".
 */
export function splitLatestThreads<T>(
  threads: readonly T[],
  options: { readonly isActive?: (thread: T) => boolean; readonly latest?: number } = {},
): { readonly shown: readonly T[]; readonly olderCount: number } {
  const latest = options.latest ?? LATEST_THREAD_COUNT;
  if (threads.length <= latest) return { shown: threads, olderCount: 0 };
  const shown = threads.filter((thread, index) => index < latest || options.isActive?.(thread));
  return { shown, olderCount: threads.length - shown.length };
}

export type ThreadSquareTone = "running" | "needs-you" | "failed" | "done" | "idle";

/**
 * The 7px status square of a thread row: green running, amber needs you, red
 * failed, dim idle. Waiting on the user outranks everything, then running.
 */
export function threadSquareTone(attention: ThreadAttention, failed = false): ThreadSquareTone {
  if (attention === "needs-you") return "needs-you";
  if (attention === "running") return "running";
  if (failed) return "failed";
  if (attention === "done") return "done";
  return "idle";
}

/** The right-hand meta label of a thread row: a state word replaces the age while it applies. */
export function threadMetaLabel(tone: ThreadSquareTone, relativeAge: string): string {
  if (tone === "needs-you") return "Needs you";
  if (tone === "failed") return "failed";
  return relativeAge;
}

export type WorkspacePillView =
  | { readonly kind: "failed"; readonly text: string }
  | {
      readonly kind: "count";
      readonly tone: Exclude<WorkspacePillKind, "failed">;
      readonly text: string;
    };

/** What the one-line workspace row shows on its right: a count pill, or red "failed". */
export function workspacePillView(pill: WorkspacePill): WorkspacePillView {
  if (pill.kind === "failed") return { kind: "failed", text: "\u2297 failed" };
  return { kind: "count", tone: pill.kind, text: String(pill.count) };
}

interface VisibleOptions<T> {
  readonly latest: number;
  readonly activeKey: string | null;
  readonly keyOf: (thread: T) => string;
}

/**
 * The sessions one workspace actually renders: the latest few plus the open one
 * (all of them once "older" is opened), or only the open one when collapsed.
 * The sidebar's rows and the Ctrl+1..9 order both come from here.
 */
export function visibleWorkspaceThreads<T>(
  threads: readonly T[],
  options: VisibleOptions<T> & { readonly expanded: boolean; readonly showAll: boolean },
): { readonly rows: readonly T[]; readonly window: ThreadListWindow<T> } {
  const window = threadListWindow(threads, {
    expanded: options.showAll,
    latest: options.latest,
    isActive: (thread) => options.keyOf(thread) === options.activeKey,
  });
  const rows = options.expanded
    ? window.shown
    : threads.filter((thread) => options.keyOf(thread) === options.activeKey);
  return { rows, window };
}

export function jumpOrderKeys<T>(
  workspaces: ReadonlyArray<{
    readonly threads: readonly T[];
    readonly expanded: boolean;
    readonly showAll: boolean;
  }>,
  options: VisibleOptions<T>,
): string[] {
  return workspaces.flatMap((workspace) =>
    visibleWorkspaceThreads(workspace.threads, { ...options, ...workspace }).rows.map(
      options.keyOf,
    ),
  );
}

/** Where a session runs, for its second line: its own worktree or the workspace folder. */
export function sessionPlace(thread: {
  readonly worktreePath: string | null;
  readonly branch: string | null;
}): { readonly kind: "worktree" | "local"; readonly branch: string | null } {
  return {
    kind: thread.worktreePath?.trim() ? "worktree" : "local",
    branch: thread.branch,
  };
}
