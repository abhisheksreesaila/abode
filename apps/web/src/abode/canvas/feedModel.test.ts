import { describe, expect, it } from "vite-plus/test";

import { deriveFeed, doneMilestones, feedAge, type FeedInput, type FeedSession } from "./feedModel";

const NOW = 1_000_000;
const session = (over: Partial<FeedSession> & { title: string }): FeedSession => ({
  workspaceKey: "w1",
  workspaceName: "alpha",
  outcome: "completed",
  at: 0,
  ...over,
});
const input = (over: Partial<FeedInput>): FeedInput => ({
  sessions: [],
  milestones: [],
  snapshot: {},
  now: NOW,
  ...over,
});

describe("deriveFeed kit lines", () => {
  const change = (name: string, kind: "new" | "updated") => ({
    kind,
    key: `skills/${name}`,
    name,
    description: "",
    tokens: 40,
    local: "none" as const,
  });

  it("adds one line per source with waiting changes, after decisions and whatever their age", () => {
    const feed = deriveFeed(
      input({
        sessions: [session({ title: "fix", outcome: "waiting", at: 10 })],
        kitSources: [
          {
            id: "matt",
            name: "Matt Pocock",
            changes: [change("a", "new"), change("b", "new"), change("c", "new")],
            lastOkAt: "2026-11-04T06:00:00.000Z",
          },
          { id: "gstack", name: "gstack", changes: [] },
        ],
      }),
      50,
    );
    expect(feed.map((item) => [item.type, item.workspaceName, item.text])).toEqual([
      ["dec", "alpha", "fix is waiting on you"],
      ["kit", "Kit", "Matt Pocock added 3 skills"],
    ]);
  });
});

describe("deriveFeed", () => {
  it("names the session a line is about, so a click can open its chat", () => {
    const feed = deriveFeed(
      input({
        sessions: [
          session({ title: "fix", sessionKey: "env:t1", outcome: "waiting", at: 10 }),
          session({ title: "ship", sessionKey: "env:t2", at: 200 }),
        ],
      }),
      50,
    );
    expect(feed.map((item) => [item.text, item.sessionKey])).toEqual([
      ["fix is waiting on you", "env:t1"],
      ["ship finished", "env:t2"],
    ]);
  });

  it("lists finished and red runs newest first", () => {
    const feed = deriveFeed(
      input({
        sessions: [
          session({ title: "old", at: 100 }),
          session({ title: "new", at: 300 }),
          session({
            title: "broke",
            outcome: "failed",
            at: 200,
            workspaceKey: "w2",
            workspaceName: "beta",
          }),
          session({ title: "capped", outcome: "limited", at: 150 }),
        ],
      }),
      50,
    );
    expect(feed.map((item) => [item.type, item.text, item.workspaceName])).toEqual([
      ["sess", "new finished", "alpha"],
      ["red", "broke failed", "beta"],
      ["red", "capped hit a usage limit", "alpha"],
      ["sess", "old finished", "alpha"],
    ]);
  });

  it("keeps a run that completed exactly at last-seen out, and one a moment later in", () => {
    const feed = deriveFeed(
      input({ sessions: [session({ title: "a", at: 500 }), session({ title: "b", at: 501 })] }),
      500,
    );
    expect(feed.map((item) => item.text)).toEqual(["b finished"]);
  });

  it("pins sessions waiting on you to the top whatever the time", () => {
    const feed = deriveFeed(
      input({
        sessions: [
          session({ title: "fresh", at: 900 }),
          session({ title: "asks", outcome: "waiting", at: 10 }),
        ],
      }),
      500,
    );
    expect(feed.map((item) => [item.type, item.text])).toEqual([
      ["dec", "asks is waiting on you"],
      ["sess", "fresh finished"],
    ]);
  });

  it("shows only pinned decisions before a first look", () => {
    const feed = deriveFeed(
      input({
        sessions: [
          session({ title: "x", at: 900 }),
          session({ title: "asks", outcome: "waiting" }),
        ],
      }),
      null,
    );
    expect(feed.map((item) => item.type)).toEqual(["dec"]);
  });

  it("reports milestones that are done now but were not in the snapshot", () => {
    const feed = deriveFeed(
      input({
        milestones: [
          {
            workspaceKey: "w1",
            workspaceName: "alpha",
            done: [
              { key: "m1", name: "Setup" },
              { key: "m2", name: "Ship" },
            ],
          },
          { workspaceKey: "w2", workspaceName: "beta", done: [{ key: "m1", name: "Other" }] },
        ],
        snapshot: { w1: ["m1"] },
      }),
      1,
    );
    expect(feed).toEqual([
      { type: "ms", workspaceKey: "w1", workspaceName: "alpha", text: "Ship reached", at: NOW },
    ]);
  });

  it("shows no milestone items on a first visit", () => {
    const feed = deriveFeed(
      input({
        milestones: [
          { workspaceKey: "w1", workspaceName: "alpha", done: [{ key: "m1", name: "Setup" }] },
        ],
        snapshot: {},
      }),
      null,
    );
    expect(feed).toEqual([]);
  });
});

describe("feedAge", () => {
  it("rounds down to the largest unit", () => {
    expect(feedAge(NOW, NOW)).toBe("now");
    expect(feedAge(NOW - 5 * 60_000 - 30_000, NOW)).toBe("5m");
    expect(feedAge(NOW - 3 * 3_600_000, NOW)).toBe("3h");
    expect(feedAge(NOW - 50 * 3_600_000, NOW)).toBe("2d");
  });
});

describe("doneMilestones", () => {
  it("lists the done milestones of a plan", () => {
    const text = `## Milestone: One
### X-001: a
- **Status:** done
## Milestone: Two
### X-002: b
- **Status:** doing
`;
    expect(
      doneMilestones({ error: null, file: { exists: true, contents: text } }).map((m) => m.name),
    ).toEqual(["One"]);
  });
  it("is empty without a plan", () => {
    expect(doneMilestones({ error: null, file: null })).toEqual([]);
  });
});
