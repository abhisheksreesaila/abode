/**
 * Pure logic for the Sessions sidebar (abode F-035): which threads fill the
 * Automations and Pinned sections, Chats-first project order, and the dim
 * second line of a session row. No React here.
 */

interface SessionThreadLike {
  readonly archivedAt: string | null;
  readonly updatedAt: string;
  readonly pinnedAt?: string | null | undefined;
  readonly pinOrderKey?: string | null | undefined;
  readonly autonomous?: { readonly enabled: boolean } | null | undefined;
}

export interface SessionSections<T> {
  readonly automations: readonly T[];
  readonly pinned: readonly T[];
}

/**
 * Automations are threads with autonomous mode on; Pinned are pinned threads.
 * A thread that is both is listed under Automations, so running work stays in view.
 * Archived threads never show. The project folders still list every thread, so a
 * pinned or autonomous thread keeps its context menu there.
 */
export function groupSessionSections<T extends SessionThreadLike>(
  threads: readonly T[],
): SessionSections<T> {
  const automations: T[] = [];
  const pinned: T[] = [];
  for (const thread of threads) {
    if (thread.archivedAt !== null) continue;
    if (thread.autonomous?.enabled === true) automations.push(thread);
    else if (thread.pinnedAt != null) pinned.push(thread);
  }
  automations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  pinned.sort((a, b) => {
    // pinOrderKey is a fractional index: plain string order is the user's order.
    if (a.pinOrderKey != null && b.pinOrderKey != null && a.pinOrderKey !== b.pinOrderKey) {
      return a.pinOrderKey < b.pinOrderKey ? -1 : 1;
    }
    return (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? "");
  });
  return { automations, pinned };
}

/** The no-project "Chats" folder leads the list; every other order is kept. */
export function chatsProjectsFirst<T>(
  projects: readonly T[],
  isChats: (project: T) => boolean,
): readonly T[] {
  const chats = projects.filter(isChats);
  return chats.length === 0 ? projects : [...chats, ...projects.filter((p) => !isChats(p))];
}

export interface DiffStat {
  readonly additions: number;
  readonly deletions: number;
}

/** Lines changed across a thread's ready checkpoints; null when nothing changed. */
export function sumCheckpointDiff(
  checkpoints: ReadonlyArray<{
    readonly status: string;
    readonly files: ReadonlyArray<{ readonly additions: number; readonly deletions: number }>;
  }>,
): DiffStat | null {
  let additions = 0;
  let deletions = 0;
  for (const checkpoint of checkpoints) {
    if (checkpoint.status !== "ready") continue;
    for (const file of checkpoint.files) {
      additions += file.additions;
      deletions += file.deletions;
    }
  }
  return additions === 0 && deletions === 0 ? null : { additions, deletions };
}

export interface SessionMeta {
  /** Shown as `+N −M` in green and red; null shows the folder icon instead. */
  readonly diff: DiffStat | null;
  /** `4 mins ago`, or `mxstudio · 6 days ago` where the project is not the row's folder. */
  readonly label: string;
}

/** The second line of a session row. */
export function formatSessionMeta(input: {
  readonly diff: DiffStat | null;
  readonly relativeTime: string;
  readonly projectName?: string | undefined;
}): SessionMeta {
  const label = [input.projectName, input.relativeTime].filter((part) => part).join(" · ");
  return { diff: input.diff, label };
}
