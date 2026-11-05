import type { SkillSourcesState, SkillSourceStatus } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { dailyCheckCard, isKitProject, lastUsedLabel } from "./kitMode";

const NOW = Date.parse("2026-11-04T12:00:00.000Z");

describe("isKitProject", () => {
  it("is a project rooted at a home folder", () => {
    expect(isKitProject("/home/abhisheksreesaila")).toBe(true);
    expect(isKitProject("/home/abhisheksreesaila/")).toBe(true);
    expect(isKitProject("/Users/abhi")).toBe(true);
    expect(isKitProject("C:\\Users\\abhi")).toBe(true);
  });

  it("is not a project inside the home folder, or a system folder", () => {
    expect(isKitProject("/home/abhisheksreesaila/Projects/abode-next")).toBe(false);
    expect(isKitProject("/home")).toBe(false);
    expect(isKitProject("/srv/app")).toBe(false);
    expect(isKitProject(undefined)).toBe(false);
  });
});

describe("lastUsedLabel", () => {
  it("says unknown when no log has the skill", () => {
    expect(lastUsedLabel(undefined, NOW)).toBe("unknown");
  });

  it("reads as today, yesterday, days and months", () => {
    expect(lastUsedLabel("2026-11-04T01:00:00.000Z", NOW)).toBe("today");
    expect(lastUsedLabel("2026-11-03T05:00:00.000Z", NOW)).toBe("yesterday");
    expect(lastUsedLabel("2026-10-25T12:00:00.000Z", NOW)).toBe("10d ago");
    expect(lastUsedLabel("2026-08-01T12:00:00.000Z", NOW)).toBe("3mo ago");
  });
});

const source = (over: Partial<SkillSourceStatus>): SkillSourceStatus => ({
  id: "matt",
  name: "Matt Pocock",
  supported: true,
  skillCount: 25,
  changes: [],
  decisions: [],
  ...over,
});
const state = (...sources: SkillSourceStatus[]): SkillSourcesState => ({
  sources,
  checking: false,
});

describe("dailyCheckCard", () => {
  it("shows the last check time with sources checked and changed", () => {
    const card = dailyCheckCard(
      state(
        source({ lastCheckedAt: "2026-11-04T06:00:00.000Z", lastOkAt: "2026-11-04T06:00:00.000Z" }),
        source({
          id: "gstack",
          name: "gstack",
          lastCheckedAt: "2026-11-04T06:00:30.000Z",
          lastOkAt: "2026-11-04T06:00:30.000Z",
          changes: [
            {
              kind: "new",
              key: "a",
              name: "a",
              description: "",
              tokens: 10,
              local: "none",
            },
          ],
        }),
        source({ id: "mine", name: "Mine", supported: false }),
      ),
      NOW,
    );
    expect(card).toEqual({
      status: "done",
      statusLabel: "checked 5h ago",
      doing: "2 sources checked · 1 changed",
    });
  });

  it("names the source that failed, and keeps its text", () => {
    const card = dailyCheckCard(
      state(
        source({
          lastCheckedAt: "2026-11-04T06:00:00.000Z",
          failure: "GitHub answered 403",
        }),
      ),
      NOW,
    );
    expect(card).toEqual({
      status: "needs-you",
      statusLabel: "check failed",
      doing: "Matt Pocock: GitHub answered 403",
    });
  });

  it("says no check has run yet before the first one", () => {
    expect(dailyCheckCard(state(source({})), NOW)).toEqual({
      status: "in-progress",
      statusLabel: "not yet",
      doing: "No check has run yet. It runs daily at 06:00.",
    });
  });

  it("shows a check in progress", () => {
    expect(dailyCheckCard({ sources: [source({})], checking: true }, NOW).statusLabel).toBe(
      "checking",
    );
  });

  it("is loading until the first answer", () => {
    expect(dailyCheckCard(null, NOW).statusLabel).toBe("reading");
  });
});
