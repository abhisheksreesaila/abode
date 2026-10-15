import { isSidebarUtilityPage } from "../../components/sidebar/mainAppLocation";

export type ActivityItemId = "agents" | "search" | "settings";

export interface ActivityItem {
  readonly id: ActivityItemId;
  readonly label: string;
  readonly placement: "top" | "bottom";
}

const ACTIVITY_ITEMS: ReadonlyArray<ActivityItem> = [
  { id: "agents", label: "Agents", placement: "top" },
  { id: "search", label: "Search", placement: "top" },
  { id: "settings", label: "Settings", placement: "bottom" },
];

export function visibleActivityItems(): ReadonlyArray<ActivityItem> {
  return ACTIVITY_ITEMS;
}

/**
 * Which item is lit for a route. Search is an action, never a place. Pull requests and Usage are
 * opened from the Customizations list, so no activity item is lit on them.
 */
export function activeActivityItem(pathname: string): ActivityItemId | null {
  if (pathname === "/pull-requests" || pathname === "/usage") return null;
  if (isSidebarUtilityPage(pathname)) return "settings";
  return "agents";
}

/**
 * Agents mirrors a VS Code view icon: pressing the lit one hides the sidebar,
 * pressing it from anywhere else goes back to the sessions.
 */
export function agentsClickAction(input: {
  readonly active: ActivityItemId | null;
}): "toggle-sidebar" | "go-to-agents" {
  return input.active === "agents" ? "toggle-sidebar" : "go-to-agents";
}
