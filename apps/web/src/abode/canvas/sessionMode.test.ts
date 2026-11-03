import { describe, expect, it } from "vite-plus/test";

import { changeMode, sanitizeModes, steeringMessage, type SessionMode } from "./sessionMode";

describe("changeMode", () => {
  const run = async (from: SessionMode, to: SessionMode, error: Error | null = null) => {
    const sent: string[] = [];
    const stored: SessionMode[] = [];
    const result = await changeMode({
      from,
      to,
      store: (mode) => stored.push(mode),
      send: async (text) => {
        sent.push(text);
        return error;
      },
    });
    return { sent, stored, result };
  };

  it("sends nothing and stores nothing when the mode is the same", async () => {
    expect(await run("jam", "jam")).toEqual({ sent: [], stored: [], result: null });
  });

  it("stores the new mode and sends exactly one steering message", async () => {
    expect(await run("auto", "tell")).toEqual({
      sent: ["Mode: Tell me. Keep a one or two line brief of where you are current for me."],
      stored: ["tell"],
      result: null,
    });
  });

  it("puts the old mode back when the send fails", async () => {
    const failure = new Error("offline");
    expect(await run("auto", "grill", failure)).toEqual({
      sent: ["Mode: Grill me. Ask me before planning, one question at a time."],
      stored: ["grill", "auto"],
      result: failure,
    });
  });
});
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
