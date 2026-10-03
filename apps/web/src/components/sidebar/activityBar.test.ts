import { describe, expect, it } from "vite-plus/test";

import { formatUsageTooltip, resolveActiveActivityItem } from "./activityBar";

describe("resolveActiveActivityItem", () => {
  it("lights Sessions with the sidebar on thread routes", () => {
    expect(resolveActiveActivityItem({ pathname: "/", sidebarOpen: true })).toBe("sessions");
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
    expect(resolveActiveActivityItem({ pathname: "/usage", sidebarOpen: true })).toBe("usage");
  });
});

describe("formatUsageTooltip", () => {
  it("reads like the reference: account, percent of window, reset", () => {
    expect(
      formatUsageTooltip({
        accountLabel: "Claude Max",
        usedPercent: 5.6,
        windowLabel: "5h",
        reset: "3:40pm",
      }),
    ).toBe("Claude Max · 6% of 5h · resets 3:40pm");
  });

  it("leaves the reset out when it is unknown", () => {
    expect(
      formatUsageTooltip({
        accountLabel: "Claude Max",
        usedPercent: 40,
        windowLabel: "5h",
        reset: null,
      }),
    ).toBe("Claude Max · 40% of 5h");
  });
});
