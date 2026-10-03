/** Which activity bar button is lit (abode F-028, F-036). */
export type ActivityBarItemId = "sessions" | "pull-requests" | "usage" | "connections" | "settings";

export const ACTIVITY_BAR_WIDTH_PX = 48;

/**
 * Pages own their buttons; anywhere else the Sessions button reflects the sidebar,
 * like VS Code's Explorer: lit while the sidebar is open.
 */
export function resolveActiveActivityItem(input: {
  readonly pathname: string;
  readonly sidebarOpen: boolean;
}): ActivityBarItemId | null {
  const { pathname } = input;
  if (pathname === "/settings/connections" || pathname.startsWith("/settings/connections/")) {
    return "connections";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  if (pathname === "/pull-requests" || pathname.startsWith("/pull-requests/")) {
    return "pull-requests";
  }
  if (pathname === "/usage") return "usage";
  return input.sidebarOpen ? "sessions" : null;
}

/** The tooltip of the usage button: `Claude Max · 6% of 5h · resets 3:40pm`. */
export function formatUsageTooltip(input: {
  readonly accountLabel: string;
  readonly usedPercent: number;
  readonly windowLabel: string;
  readonly reset: string | null;
}): string {
  const used = `${Math.round(input.usedPercent)}% of ${input.windowLabel}`;
  return [input.accountLabel, used, input.reset ? `resets ${input.reset}` : null]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(" · ");
}
