import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import type { LimitAccount } from "@t3tools/shared/usageLimits";
import { describe, expect, it } from "vite-plus/test";

import {
  compactWindowLabel,
  formatResetAbsolute,
  pickClosestWindow,
  usageTone,
  windowRowLabel,
} from "./usageStatus";

const now0 = Date.parse("2026-10-01T10:00:00.000Z");

const win = (
  id: string,
  kind: ServerProviderUsageWindow["kind"],
  label: string,
  usedPercent: number,
  extra: Partial<ServerProviderUsageWindow> = {},
): ServerProviderUsageWindow => ({ id, kind, label, usedPercent, ...extra });

const account = (windows: ServerProviderUsageWindow[]) =>
  ({
    key: "k",
    limits: { checkedAt: "2026-10-01T00:00:00.000Z", windows },
  }) as unknown as LimitAccount;

describe("usageTone", () => {
  it("is amber from 80 and red from 95", () => {
    expect(usageTone(79.9)).toBe("ok");
    expect(usageTone(80)).toBe("warn");
    expect(usageTone(94.9)).toBe("warn");
    expect(usageTone(95)).toBe("critical");
  });
});

describe("pickClosestWindow", () => {
  it("returns null with no windows", () => {
    expect(pickClosestWindow([account([])], now0)).toBeNull();
  });
  it("picks the highest used percent across accounts", () => {
    const a = account([win("five_hour", "session", "Session", 42)]);
    const b = account([
      win("seven_day", "weekly", "Weekly", 61),
      win("o", "weekly", "Weekly · Opus", 83),
    ]);
    expect(pickClosestWindow([a, b], now0)?.window.id).toBe("o");
  });
  it("skips windows whose reset has passed", () => {
    const a = account([
      win("stale", "session", "Session", 99, { resetsAt: "2026-10-01T09:00:00.000Z" }),
      win("live", "weekly", "Weekly", 40, { resetsAt: "2026-10-05T09:00:00.000Z" }),
    ]);
    expect(pickClosestWindow([a], now0)?.window.id).toBe("live");
  });
  it("never picks Cursor's combined Overall figure", () => {
    const a = account([
      win("totalPercentUsed", "other", "Overall", 90),
      win("autoPercentUsed", "other", "Cursor Models", 60),
    ]);
    expect(pickClosestWindow([a], now0)?.window.id).toBe("autoPercentUsed");
  });
  it("breaks ties by the sooner reset", () => {
    const a = account([
      win("late", "weekly", "Weekly", 50, { resetsAt: "2026-10-05T09:00:00.000Z" }),
      win("soon", "session", "Session", 50, { resetsAt: "2026-10-01T15:40:00.000Z" }),
    ]);
    expect(pickClosestWindow([a], now0)?.window.id).toBe("soon");
  });
});

describe("labels", () => {
  it("shortens windows for the sidebar item", () => {
    expect(compactWindowLabel(win("a", "session", "Session", 1, { windowDurationMins: 300 }))).toBe(
      "5h",
    );
    expect(compactWindowLabel(win("b", "weekly", "Weekly", 1))).toBe("week");
    expect(compactWindowLabel(win("c", "weekly", "Weekly · Opus", 1))).toBe("week · Opus");
  });
  it("names popover rows", () => {
    expect(windowRowLabel(win("a", "session", "Session", 1, { windowDurationMins: 300 }))).toBe(
      "Session (5h), all models",
    );
    expect(windowRowLabel(win("b", "weekly", "Weekly", 1))).toBe("Weekly, all models");
    expect(windowRowLabel(win("c", "weekly", "Weekly · Opus", 1))).toBe("Weekly, Opus");
  });
});

describe("formatResetAbsolute", () => {
  // Local-time construction keeps the test timezone-independent.
  const at = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m - 1, d, h, min).toISOString();
  const now = new Date(2026, 9, 1, 10, 0).getTime(); // Thu 1 Oct 2026
  it("shows only the time today", () => {
    expect(formatResetAbsolute(at(2026, 10, 1, 15, 40), now, "12-hour")).toBe("3:40pm");
  });
  it("leads with the weekday within a week", () => {
    expect(formatResetAbsolute(at(2026, 10, 5, 9, 0), now, "12-hour")).toBe("Mon 9:00am");
  });
  it("uses a date beyond a week, and 24h on request", () => {
    expect(formatResetAbsolute(at(2026, 10, 20, 21, 5), now, "24-hour")).toBe("Oct 20 21:05");
  });
  it("is null once the reset has passed", () => {
    expect(formatResetAbsolute(at(2026, 10, 1, 9, 0), now, "12-hour")).toBeNull();
  });
  it("is null for a bad date", () => {
    expect(formatResetAbsolute("nope", now, "12-hour")).toBeNull();
  });
});
