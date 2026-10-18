import { describe, expect, it } from "vite-plus/test";

import {
  buildWorkspaceRows,
  needsSessionDetail,
  sessionActivityAt,
  summarizeRows,
  type SessionDetail,
  type SessionSummary,
  type WorkspaceInput,
} from "./workspaceRows";

const session = (key: string, over: Partial<SessionSummary> = {}): SessionSummary => ({
  key,
  environmentId: "env-local",
  environmentLabel: "This computer",
  state: { attention: null, failed: false },
  activityAt: "2026-10-17T10:00:00.000Z",
  runningSubagents: 0,
  ...over,
});
const workspace = (key: string, sessions: SessionSummary[]): WorkspaceInput => ({
  key,
  name: key,
  sessions,
});
const running = { attention: "running", failed: false } as const;
const needsYou = { attention: "needs-you", failed: false } as const;
const failed = { attention: null, failed: true } as const;
const detail = (done: number, total: number, question: string | null = null): SessionDetail => ({
  progress: { done, total },
  question,
});

describe("buildWorkspaceRows", () => {
  it("ranks status: needs you, then running, failed, done, idle", () => {
    const rows = buildWorkspaceRows(
      [
        workspace("a", [session("a1", { state: running }), session("a2", { state: needsYou })]),
        workspace("b", [session("b1", { state: running }), session("b2", { state: failed })]),
        workspace("c", [session("c1", { state: failed })]),
        workspace("d", [session("d1", { state: { attention: "done", failed: false } })]),
        workspace("e", [session("e1")]),
      ],
      new Map(),
    );
    expect(rows.map((row) => [row.key, row.status])).toEqual([
      ["a", "needs-you"],
      ["b", "running"],
      ["c", "failed"],
      ["d", "done"],
      ["e", "idle"],
    ]);
  });

  it("sorts needs-you rows first and keeps the given order otherwise", () => {
    const rows = buildWorkspaceRows(
      [
        workspace("idle", [session("i")]),
        workspace("run", [session("r", { state: running })]),
        workspace("ask", [session("q", { state: needsYou })]),
      ],
      new Map(),
    );
    expect(rows.map((row) => row.key)).toEqual(["ask", "idle", "run"]);
  });

  it("sums task lists of running and needs-you sessions into one percentage", () => {
    const rows = buildWorkspaceRows(
      [
        workspace("w", [
          session("s1", { state: running }),
          session("s2", { state: needsYou }),
          session("s3"),
        ]),
      ],
      new Map([
        ["s1", detail(3, 5)],
        ["s2", detail(4, 5)],
        ["s3", detail(1, 1)],
      ]),
    );
    expect(rows[0]?.progress).toEqual({ done: 7, total: 10, percent: 70, tone: "working" });
  });

  it("colours the bar green at 100%, else amber", () => {
    const tone = (state: SessionSummary["state"], d: SessionDetail) =>
      buildWorkspaceRows([workspace("w", [session("s", { state })])], new Map([["s", d]]))[0]
        ?.progress?.tone;
    expect(tone(running, detail(9, 9))).toBe("done");
    expect(tone(running, detail(3, 9))).toBe("working");
  });

  it("has no progress when no active session keeps a task list", () => {
    const rows = buildWorkspaceRows(
      [workspace("w", [session("s1", { state: running })])],
      new Map([["s1", { progress: null, question: null }]]),
    );
    expect(rows[0]?.progress).toBeNull();
  });

  it("counts running sessions plus running subagents as agents", () => {
    const rows = buildWorkspaceRows(
      [
        workspace("w", [
          session("s1", { state: running, runningSubagents: 2 }),
          session("s2", { state: needsYou, runningSubagents: 1 }),
          session("s3"),
        ]),
      ],
      new Map(),
    );
    expect(rows[0]?.agents).toBe(4);
  });

  it("lists each machine once and the latest activity", () => {
    const rows = buildWorkspaceRows(
      [
        workspace("w", [
          session("s1", { activityAt: "2026-10-17T09:00:00.000Z" }),
          session("s2", {
            environmentId: "env-mac",
            environmentLabel: "MacBook Air",
            activityAt: "2026-10-17T11:00:00.000Z",
          }),
          session("s3", { activityAt: "2026-10-16T09:00:00.000Z" }),
        ]),
      ],
      new Map(),
    );
    expect(rows[0]?.machines).toEqual(["This computer", "MacBook Air"]);
    expect(rows[0]?.environmentIds).toEqual(["env-local", "env-mac"]);
    expect(rows[0]?.activityAt).toBe("2026-10-17T11:00:00.000Z");
  });

  it("opens the needs-you session, else a running one, else the most recent", () => {
    const open = (sessions: SessionSummary[]) =>
      buildWorkspaceRows([workspace("w", sessions)], new Map())[0]?.openSessionKey;
    expect(
      open([
        session("run", { state: running }),
        session("ask", { state: needsYou }),
        session("old"),
      ]),
    ).toBe("ask");
    expect(open([session("old"), session("run", { state: running })])).toBe("run");
    expect(
      open([
        session("old", { activityAt: "2026-10-01T00:00:00.000Z" }),
        session("new", { activityAt: "2026-10-17T00:00:00.000Z" }),
      ]),
    ).toBe("new");
    expect(open([])).toBeNull();
  });

  it("shows the waiting question of the needs-you session", () => {
    const rows = buildWorkspaceRows(
      [workspace("w", [session("ask", { state: needsYou })])],
      new Map([["ask", detail(1, 2, "Keep the old card?")]]),
    );
    expect(rows[0]?.question).toBe("Keep the old card?");
  });

  it("shows no question for a workspace that is not waiting", () => {
    const rows = buildWorkspaceRows(
      [workspace("w", [session("s", { state: running })])],
      new Map([["s", detail(1, 2, "stale")]]),
    );
    expect(rows[0]?.question).toBeNull();
  });
});

describe("needsSessionDetail", () => {
  it("is true only for running and needs-you sessions", () => {
    expect(needsSessionDetail(running)).toBe(true);
    expect(needsSessionDetail(needsYou)).toBe(true);
    expect(needsSessionDetail({ attention: "done", failed: false })).toBe(false);
    expect(needsSessionDetail(failed)).toBe(false);
  });
});

describe("summarizeRows", () => {
  it("counts rows per status, leaving out zeros", () => {
    const rows = buildWorkspaceRows(
      [
        workspace("a", [session("a", { state: needsYou })]),
        workspace("b", [session("b", { state: running })]),
        workspace("c", [session("c", { state: running })]),
        workspace("d", [session("d")]),
        workspace("e", [session("e", { state: failed })]),
      ],
      new Map(),
    );
    expect(summarizeRows(rows)).toBe("1 needs you · 2 running · 1 idle · 1 failed");
  });
});

describe("sessionActivityAt", () => {
  const times = {
    latestUserMessageAt: "2026-10-17T08:00:00.000Z",
    updatedAt: "2026-10-17T09:00:00.000Z",
    runtimeUpdatedAt: "2026-10-17T10:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
  };
  it("uses the latest update of a running session", () => {
    expect(sessionActivityAt(running, times)).toBe("2026-10-17T10:00:00.000Z");
  });
  it("uses the last user message of an idle session", () => {
    expect(sessionActivityAt({ attention: null, failed: false }, times)).toBe(
      "2026-10-17T08:00:00.000Z",
    );
  });
});
