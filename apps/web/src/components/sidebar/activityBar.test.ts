import { describe, expect, it } from "vite-plus/test";

import { resolveActiveActivityItem } from "./activityBar";

describe("resolveActiveActivityItem", () => {
  it("lights Agents with the sidebar on thread routes", () => {
    expect(resolveActiveActivityItem({ pathname: "/", sidebarOpen: true })).toBe("agents");
    expect(resolveActiveActivityItem({ pathname: "/", sidebarOpen: false })).toBeNull();
  });

  it("lets pages own their button", () => {
    expect(resolveActiveActivityItem({ pathname: "/settings", sidebarOpen: true })).toBe(
      "settings",
    );
    expect(
      resolveActiveActivityItem({ pathname: "/settings/connections", sidebarOpen: true }),
    ).toBe("connections");
    expect(resolveActiveActivityItem({ pathname: "/pull-requests", sidebarOpen: true })).toBe(
      "pull-requests",
    );
  });
});
