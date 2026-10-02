import { describe, expect, it } from "vite-plus/test";

import { AUTONOMOUS_ACCESS_WARNING, resolveAutonomousChip } from "./autonomousChip.logic";

describe("resolveAutonomousChip", () => {
  it("is off for threads from servers that never heard of the field", () => {
    expect(resolveAutonomousChip(undefined, "full-access")).toMatchObject({
      on: false,
      label: "Autonomous",
    });
    expect(resolveAutonomousChip(null, "full-access").on).toBe(false);
  });

  it("shows the running count while on", () => {
    expect(
      resolveAutonomousChip({ enabled: true, count: 3, cap: 30 }, "full-access"),
    ).toMatchObject({ on: true, label: "auto 3/30" });
  });

  it("warns about approvals only when access is not full", () => {
    const state = { enabled: true, count: 0, cap: 30 };
    expect(resolveAutonomousChip(state, "full-access").tooltip).not.toContain(
      AUTONOMOUS_ACCESS_WARNING,
    );
    expect(resolveAutonomousChip(state, "approval-required").tooltip).toContain(
      AUTONOMOUS_ACCESS_WARNING,
    );
  });

  it("says why it stopped once off", () => {
    const view = resolveAutonomousChip(
      { enabled: false, count: 30, cap: 30, stopReason: "cap" },
      "full-access",
    );
    expect(view.on).toBe(false);
    expect(view.tooltip).toContain("cap");
  });
});
