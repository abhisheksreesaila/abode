/** Which activity bar button is lit (abode F-028). */
export type ActivityBarItemId = "agents" | "pull-requests" | "connections" | "settings";

export const ACTIVITY_BAR_WIDTH_PX = 48;

/**
 * Pages own their buttons; anywhere else the Agents button reflects the sidebar,
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
  return input.sidebarOpen ? "agents" : null;
}
