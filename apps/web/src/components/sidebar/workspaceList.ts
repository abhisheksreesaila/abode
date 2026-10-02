/**
 * Pure logic for the compact workspace list (abode F-024): the initials tile,
 * the location line, the status pill and the latest-two split. No React here.
 */

/** Two letters for the tile: `finxplorer` -> `FI`, `travel-os` -> `TO`, `My App` -> `MA`. */
export function workspaceInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? Array.from(words[0]!).slice(0, 2)
      : words.slice(0, 2).map((word) => Array.from(word)[0]!);
  return letters.join("").toUpperCase();
}

const HOME_PREFIX =
  /^(?:\/home\/[^/]+|\/Users\/[^/]+|\/root|[A-Za-z]:[\\/]+Users[\\/]+[^\\/]+)(?=[\\/]|$)/;

/** `/home/me/Projects/x` -> `~/Projects/x`. Anything outside a home directory is left alone. */
export function homeRelativePath(path: string): string {
  const trimmed = path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
  const match = HOME_PREFIX.exec(trimmed);
  if (!match) return trimmed;
  const rest = trimmed.slice(match[0].length).replace(/\\/g, "/");
  return `~${rest}`;
}

/**
 * The second line of a workspace header: the home-relative folder, led by the
 * machine label when the workspace does not live on this environment.
 */
export function formatWorkspaceLocation(input: {
  readonly workspaceRoot: string;
  readonly remoteEnvironmentLabels: readonly string[];
  readonly isRemoteOnly: boolean;
}): string {
  const path = homeRelativePath(input.workspaceRoot);
  const machine = input.isRemoteOnly
    ? input.remoteEnvironmentLabels.filter((label) => label.length > 0).join(", ")
    : "";
  return machine ? `${machine} · ${path}` : path;
}

export type WorkspacePillKind = "needs-you" | "failed" | "running" | "done";

export interface WorkspacePill {
  readonly kind: WorkspacePillKind;
  readonly count: number;
  /** `2 running`, `1 needs you`, `failed`. */
  readonly label: string;
  /** Every non-zero bucket, for the tooltip. */
  readonly detail: string;
}

export interface WorkspaceThreadState {
  /** Label of the thread's status pill (`Working`, `Awaiting Input`, ...), if any. */
  readonly statusLabel: string | null;
  /** The thread errored and has not been visited since (same unseen rule as completions). */
  readonly failedUnseen: boolean;
}

export const NEEDS_YOU_LABELS = new Set(["Pending Approval", "Awaiting Input", "Plan Ready"]);
export const RUNNING_LABELS = new Set(["Working", "Connecting", "Monitoring", "Auto"]);

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
    if (thread.statusLabel !== null && NEEDS_YOU_LABELS.has(thread.statusLabel)) {
      counts["needs-you"] += 1;
    } else if (thread.statusLabel !== null && RUNNING_LABELS.has(thread.statusLabel)) {
      counts.running += 1;
    } else if (thread.failedUnseen) {
      counts.failed += 1;
    } else if (thread.statusLabel === "Completed") {
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

export type ThreadSquareTone = "running" | "needs-you" | "done" | "idle";

/** The 7px status square of a thread row (F-028): green running, amber needs you, dim idle. */
export function threadSquareTone(statusLabel: string | null): ThreadSquareTone {
  if (statusLabel === null) return "idle";
  if (NEEDS_YOU_LABELS.has(statusLabel)) return "needs-you";
  if (RUNNING_LABELS.has(statusLabel)) return "running";
  if (statusLabel === "Completed") return "done";
  return "idle";
}

/** The right-hand meta label of a thread row: "needs you" replaces the age while it waits. */
export function threadMetaLabel(tone: ThreadSquareTone, relativeAge: string): string {
  return tone === "needs-you" ? "needs you" : relativeAge;
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
