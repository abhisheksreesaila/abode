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

export type WorkspacePillKind = "needs-you" | "failed" | "running";

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
  readonly sessionStatus: string | null | undefined;
}

const NEEDS_YOU_LABELS = new Set(["Pending Approval", "Awaiting Input", "Plan Ready"]);
const RUNNING_LABELS = new Set(["Working", "Connecting"]);

function describeBucket(kind: WorkspacePillKind, count: number): string {
  if (kind === "running") return `${count} running`;
  if (kind === "needs-you") return `${count} needs you`;
  return count === 1 ? "failed" : `${count} failed`;
}

/**
 * The one pill a workspace header shows, so it fits a narrow sidebar and stays
 * visible collapsed. Attention outranks failure, which outranks running.
 */
export function resolveWorkspacePill(
  threads: readonly WorkspaceThreadState[],
): WorkspacePill | null {
  const counts: Record<WorkspacePillKind, number> = { "needs-you": 0, failed: 0, running: 0 };
  for (const thread of threads) {
    if (thread.statusLabel !== null && NEEDS_YOU_LABELS.has(thread.statusLabel)) {
      counts["needs-you"] += 1;
    } else if (thread.statusLabel !== null && RUNNING_LABELS.has(thread.statusLabel)) {
      counts.running += 1;
    } else if (thread.sessionStatus === "error") {
      counts.failed += 1;
    }
  }
  const order: WorkspacePillKind[] = ["needs-you", "failed", "running"];
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

/**
 * The threads a workspace shows by default: its latest two, plus the "+N older"
 * count. The active thread is never hidden behind "+N older".
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
