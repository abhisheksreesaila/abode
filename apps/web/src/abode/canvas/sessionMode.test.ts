import { describe, expect, it } from "vite-plus/test";

import { sanitizeModes, steeringMessage } from "./sessionMode";
import { modeOf, useSessionModeStore } from "./sessionModeStore";

describe("steeringMessage", () => {
  it("picks the message of the mode the session moves to", () => {
    expect(steeringMessage("auto", "grill")).toBe(
      "Mode: Grill me. Ask me before planning, one question at a time.",
    );
    expect(steeringMessage("grill", "auto")).toBe(
      "Mode: Autopilot. Carry on by yourself; only stop for anything blocked or irreversible.",
    );
  });

  it("sends nothing when the mode did not change", () => {
    expect(steeringMessage("jam", "jam")).toBeNull();
  });
});

describe("session modes", () => {
  it("defaults to autopilot and keeps only known, non-default modes from storage", () => {
    expect(modeOf({}, "env:t1")).toBe("auto");
    expect(sanitizeModes({ a: "grill", b: "bogus", c: "auto", d: 3, e: "jam" })).toEqual({
      a: "grill",
      e: "jam",
    });
    expect(sanitizeModes(null)).toEqual({});
  });

  it("stores a changed mode per session and drops it again when set back to autopilot", () => {
    const { setMode } = useSessionModeStore.getState();
    setMode("env:t1", "tell");
    setMode("env:t2", "jam");
    expect(useSessionModeStore.getState().modes).toEqual({ "env:t1": "tell", "env:t2": "jam" });
    setMode("env:t1", "auto");
    expect(useSessionModeStore.getState().modes).toEqual({ "env:t2": "jam" });
    setMode("env:t2", "auto");
  });
});
