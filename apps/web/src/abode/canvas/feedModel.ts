/** "Since you last looked" (A-049) as plain data: the overview's feed, newest first. */
import { planBlock, type PlanFileState } from "./planBlock";

export type FeedType = "ms" | "dec" | "red" | "pr" | "sess";

export interface FeedItem {
  readonly type: FeedType;
  readonly workspaceKey: string;
  readonly workspaceName: string;
  /** The session the line is about (a pill's key); milestone lines have none. */
  readonly sessionKey?: string;
  readonly text: string;
  /** Epoch ms. */
  readonly at: number;
}

export interface FeedSession {
  readonly workspaceKey: string;
  readonly workspaceName: string;
  readonly sessionKey?: string;
  readonly title: string;
  /** waiting: a pending approval or question; limited: a usage limit stopped the run. */
  readonly outcome: "waiting" | "completed" | "failed" | "limited" | "other";
  /** Epoch ms the run ended (or the session last moved). */
  readonly at: number;
}

export interface DoneMilestone {
  readonly key: string;
  readonly name: string;
}

export interface FeedInput {
  readonly sessions: ReadonlyArray<FeedSession>;
  readonly milestones: ReadonlyArray<{
    readonly workspaceKey: string;
    readonly workspaceName: string;
    readonly done: ReadonlyArray<DoneMilestone>;
  }>;
  /** Done milestone keys per workspace as of the last close; no entry = never seen. */
  readonly snapshot: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly now: number;
}

/** Compact age for a feed line: "now", "5m", "3h", "2d". */
export function feedAge(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** The milestones a plan.md reports done; nothing until the file is read. */
export function doneMilestones(state: PlanFileState): DoneMilestone[] {
  const block = planBlock(state);
  if (block.kind !== "ready") return [];
  return block.rows
    .filter((row) => row.state === "done")
    .map((row) => ({ key: row.key, name: row.name }));
}

/**
 * Decisions waiting on you come first, whatever their age. Everything else is newer than
 * `lastSeenAt` (nothing before a first look), newest first.
 */
export function deriveFeed(input: FeedInput, lastSeenAt: number | null): FeedItem[] {
  const since = lastSeenAt ?? Number.POSITIVE_INFINITY;
  const pinned: FeedItem[] = [];
  const recent: FeedItem[] = [];
  for (const s of input.sessions) {
    const base = {
      workspaceKey: s.workspaceKey,
      workspaceName: s.workspaceName,
      at: s.at,
      ...(s.sessionKey === undefined ? {} : { sessionKey: s.sessionKey }),
    };
    if (s.outcome === "waiting") {
      pinned.push({ ...base, type: "dec", text: `${s.title} is waiting on you` });
    } else if (s.at > since) {
      if (s.outcome === "completed") {
        recent.push({ ...base, type: "sess", text: `${s.title} finished` });
      } else if (s.outcome === "failed") {
        recent.push({ ...base, type: "red", text: `${s.title} failed` });
      } else if (s.outcome === "limited") {
        recent.push({ ...base, type: "red", text: `${s.title} hit a usage limit` });
      }
    }
  }
  for (const m of input.milestones) {
    const seen = input.snapshot[m.workspaceKey];
    if (seen === undefined) continue;
    for (const done of m.done) {
      if (seen.includes(done.key)) continue;
      recent.push({
        type: "ms",
        workspaceKey: m.workspaceKey,
        workspaceName: m.workspaceName,
        text: `${done.name} reached`,
        at: input.now,
      });
    }
  }
  const newestFirst = (a: FeedItem, b: FeedItem) => b.at - a.at;
  return [...pinned.sort(newestFirst), ...recent.sort(newestFirst)];
}
