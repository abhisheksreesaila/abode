import { describe, expect, it } from "vite-plus/test";

import {
  detectAutonomousDone,
  greetingForHour,
  isCoffeeTime,
  isFridayShipTime,
  minuteToDate,
  parseDelightsEnabled,
  reduceSparkle,
  sendTooltip,
  type AutonomousSnapshot,
} from "./delights.logic";

// Local-time constructor. 2026-10-02 is a Friday.
const at = (hour: number, minute = 0, day = 2) => new Date(2026, 9, day, hour, minute);

describe("isCoffeeTime", () => {
  it("covers 15:00 up to but not including 15:30", () => {
    expect(isCoffeeTime(at(14, 59))).toBe(false);
    expect(isCoffeeTime(at(15, 0))).toBe(true);
    expect(isCoffeeTime(at(15, 29))).toBe(true);
    expect(isCoffeeTime(at(15, 30))).toBe(false);
  });
});

describe("greetingForHour", () => {
  it.each([
    [5, "Good morning ☀️"],
    [11, "Good morning ☀️"],
    [12, "Good afternoon"],
    [16, "Good afternoon"],
    [17, "Evening 🌙"],
    [22, "Evening 🌙"],
    [23, "Burning the midnight oil? 🦉"],
    [0, "Burning the midnight oil? 🦉"],
    [4, "Burning the midnight oil? 🦉"],
  ])("hour %i", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("isFridayShipTime", () => {
  it("is Friday from 15:00", () => {
    expect(isFridayShipTime(at(14, 59, 2))).toBe(false);
    expect(isFridayShipTime(at(15, 0, 2))).toBe(true);
    expect(isFridayShipTime(at(15, 0, 3))).toBe(false);
  });
});

describe("sendTooltip", () => {
  it("says Ship it only on a Friday afternoon with delights on", () => {
    expect(sendTooltip(at(16), true)).toBe("Ship it 🚢");
    expect(sendTooltip(at(16), false)).toBeNull();
    expect(sendTooltip(at(16, 0, 3), true)).toBeNull();
  });
});

describe("minuteToDate", () => {
  it("reads the UTC minute string as an instant", () => {
    expect(minuteToDate("2026-10-02T15:30").toISOString()).toBe("2026-10-02T15:30:00.000Z");
  });
});

describe("parseDelightsEnabled", () => {
  it("defaults on and only an explicit false turns it off", () => {
    expect(parseDelightsEnabled(null)).toBe(true);
    expect(parseDelightsEnabled("garbage")).toBe(true);
    expect(parseDelightsEnabled('{"enabled":true}')).toBe(true);
    expect(parseDelightsEnabled('{"enabled":false}')).toBe(false);
  });
});

describe("detectAutonomousDone", () => {
  const snap = (over: Partial<AutonomousSnapshot>): AutonomousSnapshot => ({
    threadKey: "t1",
    enabled: true,
    count: 2,
    stopReason: null,
    ...over,
  });

  it("fires when a running run stops with done on the same thread", () => {
    const next = snap({ enabled: false, stopReason: "done", count: 3 });
    expect(detectAutonomousDone(snap({}), next)).toEqual({ turns: 4 });
  });

  it("does not fire for other stop reasons", () => {
    for (const reason of ["cap", "error", "interrupted", "rate-limited", null]) {
      expect(
        detectAutonomousDone(snap({}), snap({ enabled: false, stopReason: reason })),
      ).toBeNull();
    }
  });

  it("does not fire when first seeing an already-finished thread", () => {
    expect(detectAutonomousDone(null, snap({ enabled: false, stopReason: "done" }))).toBeNull();
  });

  it("does not fire when switching to another thread that is done", () => {
    const next = snap({ threadKey: "t2", enabled: false, stopReason: "done" });
    expect(detectAutonomousDone(snap({}), next)).toBeNull();
  });

  it("fires once per run: an unchanged done state does not re-fire", () => {
    const done = snap({ enabled: false, stopReason: "done" });
    expect(detectAutonomousDone(done, done)).toBeNull();
  });
});

describe("reduceSparkle", () => {
  it("does not replay the sparkle when returning to a finished thread (A -> B -> A)", () => {
    let state = reduceSparkle({ threadKey: null, token: 0 }, { type: "thread", threadKey: "A" });
    state = reduceSparkle(state, { type: "done", threadKey: "A" });
    expect(state).toEqual({ threadKey: "A", token: 1 });
    state = reduceSparkle(state, { type: "thread", threadKey: "B" });
    state = reduceSparkle(state, { type: "thread", threadKey: "A" });
    expect(state).toEqual({ threadKey: "A", token: 0 });
  });

  it("bumps the token for a second finished run on the same thread", () => {
    let state = reduceSparkle({ threadKey: null, token: 0 }, { type: "thread", threadKey: "A" });
    state = reduceSparkle(state, { type: "done", threadKey: "A" });
    state = reduceSparkle(state, { type: "done", threadKey: "A" });
    expect(state.token).toBe(2);
  });
});
