import { describe, expect, it } from "vite-plus/test";

import { activeActivityItem, agentsClickAction, visibleActivityItems } from "./activityBar";

describe("activeActivityItem", () => {
  it.each([
    ["/", "agents"],
    ["/draft/abc", "agents"],
    ["/env-1/thread-1", "agents"],
    ["/pull-requests", null],
    ["/usage", null],
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
    expect(agentsClickAction({ active: activeActivityItem("/usage") })).toBe("go-to-agents");
    expect(agentsClickAction({ active: activeActivityItem("/pull-requests") })).toBe(
      "go-to-agents",
    );
  });
});

describe("visibleActivityItems", () => {
  it("lists Agents and Search on top, with Settings alone at the bottom", () => {
    const items = visibleActivityItems();
    expect(items.filter((i) => i.placement === "top").map((i) => i.id)).toEqual([
      "agents",
      "search",
    ]);
    expect(items.filter((i) => i.placement === "bottom").map((i) => i.id)).toEqual(["settings"]);
  });
});
