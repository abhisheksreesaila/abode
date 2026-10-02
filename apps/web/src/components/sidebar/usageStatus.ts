import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import type { TimestampFormat } from "@t3tools/contracts/settings";
import type { LimitAccount } from "@t3tools/shared/usageLimits";

import { formatShortTimestamp } from "../../timestampFormat";

/** Cursor's "Overall" window: shown in the popover, never the closest one. */
const COMBINED_WINDOW_ID = "totalPercentUsed";

/** True when a reset time is known and already behind us. */
export function hasReset(isoDate: string | undefined, now: number): boolean {
  return isoDate !== undefined && Date.parse(isoDate) <= now;
}

export const USAGE_WARN_PERCENT = 80;
export const USAGE_CRITICAL_PERCENT = 95;

export type UsageTone = "ok" | "warn" | "critical";

export function usageTone(usedPercent: number): UsageTone {
  if (usedPercent >= USAGE_CRITICAL_PERCENT) return "critical";
  if (usedPercent >= USAGE_WARN_PERCENT) return "warn";
  return "ok";
}

export interface StatusWindow {
  readonly account: LimitAccount;
  readonly window: ServerProviderUsageWindow;
}

/**
 * The window nearest its limit across every account, which is the one the
 * sidebar item shows. Ties go to the window that resets sooner, because it is
 * the one the user will be unblocked by first.
 */
export function pickClosestWindow(
  accounts: readonly LimitAccount[],
  now: number,
): StatusWindow | null {
  let best: StatusWindow | null = null;
  const resetMs = (window: ServerProviderUsageWindow) =>
    window.resetsAt ? Date.parse(window.resetsAt) : Number.POSITIVE_INFINITY;
  for (const account of accounts) {
    for (const window of account.limits.windows) {
      // Not a quota, or already reset and so stale until the next read.
      if (window.id === COMBINED_WINDOW_ID || hasReset(window.resetsAt, now)) continue;
      if (
        best === null ||
        window.usedPercent > best.window.usedPercent ||
        (window.usedPercent === best.window.usedPercent && resetMs(window) < resetMs(best.window))
      ) {
        best = { account, window };
      }
    }
  }
  return best;
}

/** `Weekly · Opus` -> `Opus`; undefined for an account-wide window. */
function modelScope(window: ServerProviderUsageWindow): string | undefined {
  const [, scope] = window.label.split(" · ");
  return scope?.trim() || undefined;
}

function sessionHours(window: ServerProviderUsageWindow): number | null {
  return window.windowDurationMins && window.windowDurationMins % 60 === 0
    ? window.windowDurationMins / 60
    : null;
}

/** Short form for the sidebar item: `5h`, `week`, `week · Opus`. */
export function compactWindowLabel(window: ServerProviderUsageWindow): string {
  if (window.kind === "session") {
    const hours = sessionHours(window);
    return hours === null ? "session" : `${hours}h`;
  }
  if (window.kind === "weekly") {
    const scope = modelScope(window);
    return scope ? `week · ${scope}` : "week";
  }
  if (window.kind === "monthly") return "month";
  return window.label.toLowerCase();
}

/** Row label for the popover: `Session (5h), all models`, `Weekly, Opus`. */
export function windowRowLabel(window: ServerProviderUsageWindow): string {
  if (window.kind === "session") {
    const hours = sessionHours(window);
    return `Session${hours === null ? "" : ` (${hours}h)`}, all models`;
  }
  if (window.kind === "weekly") return `Weekly, ${modelScope(window) ?? "all models"}`;
  if (window.kind === "monthly") return `Monthly, ${modelScope(window) ?? "all models"}`;
  return window.label;
}

/**
 * An absolute reset time. Today is just the time (`3:40pm`); another day leads
 * with the weekday (`Mon 9:00am`) while it is within a week, and a date after.
 */
export function formatResetAbsolute(
  isoDate: string,
  now: number,
  timestampFormat: TimestampFormat,
): string | null {
  const date = new Date(isoDate);
  // A reset that has passed has no time worth showing; callers say "reset".
  if (Number.isNaN(date.getTime()) || date.getTime() <= now) return null;
  const time = formatShortTimestamp(isoDate, timestampFormat).replace(
    /\s*([AP]M)$/i,
    (_, period: string) => period.toLowerCase(),
  );
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDiff = Math.round((startOf(date) - startOf(new Date(now))) / 86_400_000);
  if (dayDiff <= 0) return time;
  if (dayDiff < 7) {
    return `${new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)} ${time}`;
  }
  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)} ${time}`;
}
