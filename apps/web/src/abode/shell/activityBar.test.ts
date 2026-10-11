import { describe, expect, it } from "vite-plus/test";

import { activeActivityItem, agentsClickAction, visibleActivityItems } from "./activityBar";

describe("activeActivityItem", () => {
  it.each([
    ["/", "agents"],
    ["/draft/abc", "agents"],
    ["/env-1/thread-1", "agents"],
    ["/pull-requests", "pull-requests"],
    ["/usage", "usage"],
    ["/settings", "settings"],
    ["/settings/providers", "settings"],
    ["/projects/some-key", "settings"],
  ])("%s highlights %s", (pathname, expected) => {
    expect(activeActivityItem(pathname)).toBe(expected);
  });
});

describe("agentsClickAction", () => {
  it("toggles the sidebar, like VS Code, when Agents is already showing", () => {
    expect(agentsClickAction({ active: "agents" })).toBe("toggle-sidebar");
  });

  it("returns to the last session from a utility page", () => {
    expect(agentsClickAction({ active: "settings" })).toBe("go-to-agents");
    expect(agentsClickAction({ active: "usage" })).toBe("go-to-agents");
    expect(agentsClickAction({ active: "pull-requests" })).toBe("go-to-agents");
  });
});

describe("visibleActivityItems", () => {
  it("hides Pull requests where no environment supports them", () => {
    expect(visibleActivityItems({ pullRequestsSupported: false }).map((item) => item.id)).toEqual([
      "agents",
      "search",
      "usage",
      "settings",
    ]);
  });

  it("lists Agents, Search, Pull requests and Usage on top, with Settings alone at the bottom", () => {
    const items = visibleActivityItems({ pullRequestsSupported: true });
    expect(items.filter((i) => i.placement === "top").map((i) => i.id)).toEqual([
      "agents",
      "search",
      "pull-requests",
      "usage",
    ]);
    expect(items.filter((i) => i.placement === "bottom").map((i) => i.id)).toEqual(["settings"]);
  });
});
