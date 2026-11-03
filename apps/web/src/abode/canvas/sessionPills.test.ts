import { describe, expect, it } from "vite-plus/test";

import type { SidebarThreadSummary } from "../../types";
import { providerKey, sessionPills } from "./sessionPills";

let seq = 0;
function thread(id: string, overrides: Record<string, unknown> = {}): SidebarThreadSummary {
  seq += 1;
  return {
    environmentId: "env",
    id,
    title: `title ${id}`,
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString(),
    archivedAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    latestRun: null,
    runtime: { status: "idle" },
    lastVisitedAt: null,
    pendingBackgroundTasks: [],
    lineage: { parentThreadId: null, relationshipToParent: null },
    ...overrides,
  } as unknown as SidebarThreadSummary;
}

const drivers: Record<string, string> = {
  a: "claudeAgent",
  b: "codex",
  c: "pi",
  d: "gemini",
  e: "somethingNew",
};
const options = (subagents: Record<string, SidebarThreadSummary[]> = {}) => ({
  subagentsByParentKey: new Map(Object.entries(subagents)),
  visitedAt: () => undefined,
  driverOf: (t: SidebarThreadSummary) => drivers[t.id.slice(0, 1)],
});

describe("providerKey", () => {
  it("maps drivers to the model colours and anything else to neutral", () => {
    expect(["claudeAgent", "codex", "pi", "gemini", "x", undefined].map(providerKey)).toEqual([
      "claude",
      "codex",
      "pi",
      "gemini",
      "other",
      "other",
    ]);
  });
});

describe("sessionPills", () => {
  it("shows a running session with its model dot and no status word", () => {
    const { pills, doneCount } = sessionPills(
      [thread("a1", { runtime: { status: "running" } })],
      options(),
    );
    expect(doneCount).toBe(0);
    expect(pills).toEqual([
      {
        key: "env:a1",
        environmentId: "env",
        threadId: "a1",
        title: "title a1",
        dots: ["claude"],
        pair: false,
        status: null,
        pending: null,
      },
    ]);
  });

  it("says 'waiting on you' for approvals and questions, 'blocked' for a failed run", () => {
    const { pills } = sessionPills(
      [
        thread("a1", { hasPendingApprovals: true }),
        thread("b1", { hasPendingUserInput: true }),
        thread("c1", { runtime: { status: "failed" } }),
      ],
      options(),
    );
    expect(pills.map((pill) => pill.status)).toEqual([
      "waiting on you",
      "waiting on you",
      "blocked",
    ]);
  });

  it("shows a delegate pair as parent then child dots from the live subagents", () => {
    const parent = thread("a1", { runtime: { status: "running" } });
    const child = thread("b2", { runtime: { status: "running" } });
    const { pills } = sessionPills([parent], options({ "env:a1": [child] }));
    expect(pills[0]).toMatchObject({ dots: ["claude", "codex"], pair: true });
  });

  it("uses a neutral dot for an unknown provider", () => {
    const { pills } = sessionPills([thread("e1", { runtime: { status: "running" } })], options());
    expect(pills[0]?.dots).toEqual(["other"]);
  });

  it("keeps a never-run session live and a finished unvisited one live as 'landed'", () => {
    const { pills, doneCount } = sessionPills(
      [
        thread("a1"),
        thread("b1", {
          latestRun: { runId: "r", completedAt: "2026-10-10T10:00:00.000Z", status: "completed" },
          lastVisitedAt: "2026-10-10T09:00:00.000Z",
        }),
      ],
      options(),
    );
    expect(doneCount).toBe(0);
    expect(pills.map((pill) => [pill.threadId, pill.status])).toEqual([
      ["a1", null],
      ["b1", "landed"],
    ]);
  });

  it("folds visited idle sessions into the done count, keeping them listed", () => {
    const run = { runId: "r", completedAt: "2026-10-10T10:00:00.000Z", status: "completed" };
    const { pills, doneCount, done } = sessionPills(
      [thread("a1", { runtime: { status: "running" } }), thread("b1", { latestRun: run })],
      { ...options(), visitedAt: (t) => (t.id === "b1" ? "2026-10-10T11:00:00.000Z" : undefined) },
    );
    expect(pills.map((pill) => pill.threadId)).toEqual(["a1"]);
    expect(doneCount).toBe(1);
    expect(done.map((pill) => pill.threadId)).toEqual(["b1"]);
  });

  it("maps a plan waiting for approval to 'waiting on you'", () => {
    const { pills } = sessionPills(
      [
        thread("a1", {
          interactionMode: "plan",
          hasActionableProposedPlan: true,
          latestRun: { runId: "r", completedAt: "2026-10-10T10:00:00.000Z", status: "completed" },
        }),
      ],
      options(),
    );
    expect(pills[0]?.status).toBe("waiting on you");
  });

  it("reports the pending request a session needs answered", () => {
    const { pills } = sessionPills(
      [
        thread("a1", { hasPendingUserInput: true }),
        thread("a2", { hasPendingApprovals: true, hasPendingUserInput: true }),
        thread("a3", { runtime: { status: "running" } }),
      ],
      options(),
    );
    expect(pills.map((pill) => pill.pending)).toEqual(["input", "approval", null]);
  });
});
