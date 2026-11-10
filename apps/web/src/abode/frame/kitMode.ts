import { findProjectByPath } from "@t3tools/client-runtime/state/projects";
import type { SkillSourcesState } from "@t3tools/contracts";

const HOME_ROOT = /^(?:\/home|\/Users|[A-Za-z]:[\\/]Users)[\\/][^\\/]+[\\/]?$/;

/**
 * The Kit project is the one rooted at the host's home folder (`~`), so the agent can edit the
 * skill folders. Until the host's home is known, a home-shaped path stands in for it.
 */
export function isKitProject(workspaceRoot: string | undefined, homePath?: string): boolean {
  if (workspaceRoot === undefined) return false;
  if (homePath !== undefined) return findProjectByPath([{ workspaceRoot }], homePath) !== undefined;
  return HOME_ROOT.test(workspaceRoot);
}

/** The workspace lists leave the Kit project out: it has its own ⚙ entry. */
export function withoutKitProject<
  T extends { readonly project: { readonly workspaceRoot: string } },
>(groups: ReadonlyArray<T>, homePath?: string): T[] {
  return groups.filter((group) => !isKitProject(group.project.workspaceRoot, homePath));
}

/** Runs `task` unless one is already running; a second tap gets the first one's promise. */
export function singleFlight() {
  let running: Promise<void> | null = null;
  return (task: () => Promise<void>): Promise<void> => {
    running ??= task().finally(() => {
      running = null;
    });
    return running;
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** "today", "yesterday", "10d ago", "3mo ago"; "unknown" when no log has the skill. */
export function lastUsedLabel(lastUsedAt: string | undefined, nowMs: number): string {
  if (lastUsedAt === undefined) return "unknown";
  const ageMs = nowMs - Date.parse(lastUsedAt);
  if (!Number.isFinite(ageMs)) return "unknown";
  const days = Math.floor(ageMs / DAY_MS);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function agoLabel(iso: string, nowMs: number): string {
  const ageMs = Math.max(0, nowMs - Date.parse(iso));
  if (ageMs < 60_000) return "just now";
  if (ageMs < HOUR_MS) return `${Math.floor(ageMs / 60_000)}m ago`;
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / HOUR_MS)}h ago`;
  return `${Math.floor(ageMs / DAY_MS)}d ago`;
}

export interface DailyCheckCard {
  readonly status: "in-progress" | "needs-you" | "done";
  readonly statusLabel: string;
  readonly doing: string;
}

/** The strip's "daily check" card, from the host's last source check. */
export function dailyCheckCard(state: SkillSourcesState | null, nowMs: number): DailyCheckCard {
  if (state === null) {
    return { status: "in-progress", statusLabel: "reading", doing: "Reading the last check" };
  }
  const supported = state.sources.filter((source) => source.supported);
  const failed = supported.find((source) => source.failure !== undefined);
  const checkedAt = supported
    .flatMap((source) => (source.lastCheckedAt === undefined ? [] : [source.lastCheckedAt]))
    .toSorted()
    .at(-1);
  if (failed !== undefined) {
    return {
      status: "needs-you",
      statusLabel: "check failed",
      doing: `${failed.name}: ${failed.failure}`,
    };
  }
  if (state.checking) {
    return { status: "in-progress", statusLabel: "checking", doing: "Comparing the sources" };
  }
  if (checkedAt === undefined) {
    return {
      status: "in-progress",
      statusLabel: "not yet",
      doing: "No check has run yet. It runs daily at 06:00.",
    };
  }
  const checked = supported.filter((source) => source.lastOkAt !== undefined).length;
  const changed = supported.filter((source) => source.changes.length > 0).length;
  return {
    status: "done",
    statusLabel: `checked ${agoLabel(checkedAt, nowMs)}`,
    doing: `${checked} ${checked === 1 ? "source" : "sources"} checked · ${changed} changed`,
  };
}
