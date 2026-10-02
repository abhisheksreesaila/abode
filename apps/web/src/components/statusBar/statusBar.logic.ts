/**
 * Pure derivations for the status bar (abode F-030): counts, labels and the
 * visibility rules. No React here. Every value comes from data the app already
 * holds; a value with no source is null so the bar leaves the item out.
 */
import type { LimitAccount } from "@t3tools/shared/usageLimits";

import { formatContextPercentage } from "../chat/ContextWindowMeter.logic";
import { resolveThreadStatusPill } from "../Sidebar.logic";
import { NEEDS_YOU_LABELS, RUNNING_LABELS } from "../sidebar/workspaceList";
import type { StatusWindow } from "../sidebar/usageStatus";

type ThreadForCounts = Parameters<typeof resolveThreadStatusPill>[0]["thread"] & {
  readonly archivedAt: string | null;
};

export interface ThreadActivityCounts {
  readonly running: number;
  readonly needsYou: number;
}

/**
 * Threads working right now and threads waiting on the user, across every
 * environment. It uses the same status labels as the sidebar pills, so the bar
 * and the sidebar cannot disagree. Archived threads are not counted.
 */
export function countThreadActivity(threads: readonly ThreadForCounts[]): ThreadActivityCounts {
  let running = 0;
  let needsYou = 0;
  for (const thread of threads) {
    if (thread.archivedAt !== null) continue;
    const label = resolveThreadStatusPill({ thread })?.label;
    if (label === undefined) continue;
    if (NEEDS_YOU_LABELS.has(label)) needsYou += 1;
    else if (RUNNING_LABELS.has(label)) running += 1;
  }
  return { running, needsYou };
}

/** A string the store selector can return, so React only re-renders when a count changes. */
export function encodeCounts(counts: ThreadActivityCounts): string {
  return `${counts.running}:${counts.needsYou}`;
}

export function decodeCounts(encoded: string): ThreadActivityCounts {
  const [running, needsYou] = encoded.split(":").map(Number);
  return { running: running ?? 0, needsYou: needsYou ?? 0 };
}

export function runningLabel(count: number): string {
  return `${count} running`;
}

export function needsYouLabel(count: number): string {
  return `${count} needs you`;
}

/** `project · host`, leaving out whichever part is unknown. */
export function formatProjectHost(project: string | null, host: string | null): string | null {
  const parts = [project, host].filter((part): part is string => !!part && part.length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** `38% ctx`, or null when the provider reports no context window. */
export function formatContextStatus(percent: number | null): string | null {
  const formatted = formatContextPercentage(percent);
  return formatted === null ? null : `${formatted} ctx`;
}

function accountPlanName(account: LimitAccount): string {
  const plan = account.plan?.trim();
  return plan && plan.length > 0 ? plan : "Usage";
}

/** `Max 42%`: the plan and the quota nearest its limit. Null until limits are reported. */
export function formatUsageStatus(closest: StatusWindow | null): string | null {
  if (closest === null) return null;
  return `${accountPlanName(closest.account)} ${Math.round(closest.window.usedPercent)}%`;
}

/** The title-bar search box text: `project — thread`, or a plain prompt with neither. */
export function formatTitleSearchLabel(project: string | null, thread: string | null): string {
  const parts = [project, thread].filter(
    (part): part is string => !!part && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" — ") : "Search";
}
