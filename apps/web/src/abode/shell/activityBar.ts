import { isSidebarUtilityPage } from "../../components/sidebar/mainAppLocation";

export type ActivityItemId = "agents" | "search" | "pull-requests" | "usage" | "settings";

export interface ActivityItem {
  readonly id: ActivityItemId;
  readonly label: string;
  readonly placement: "top" | "bottom";
}

const ACTIVITY_ITEMS: ReadonlyArray<ActivityItem> = [
  { id: "agents", label: "Agents", placement: "top" },
  { id: "search", label: "Search", placement: "top" },
  { id: "pull-requests", label: "Pull requests", placement: "top" },
  { id: "usage", label: "Usage", placement: "top" },
  { id: "settings", label: "Settings", placement: "bottom" },
];

export function visibleActivityItems(input: {
  readonly pullRequestsSupported: boolean;
}): ReadonlyArray<ActivityItem> {
  return ACTIVITY_ITEMS.filter(
    (item) => item.id !== "pull-requests" || input.pullRequestsSupported,
  );
}

/** Which item is lit for a route. Search is an action, never a place. */
export function activeActivityItem(pathname: string): ActivityItemId {
  if (pathname === "/pull-requests") return "pull-requests";
  if (pathname === "/usage") return "usage";
  if (isSidebarUtilityPage(pathname)) return "settings";
  return "agents";
}

/**
 * Agents mirrors a VS Code view icon: pressing the lit one hides the sidebar,
 * pressing it from anywhere else goes back to the sessions.
 */
export function agentsClickAction(input: {
  readonly active: ActivityItemId;
}): "toggle-sidebar" | "go-to-agents" {
  return input.active === "agents" ? "toggle-sidebar" : "go-to-agents";
}
