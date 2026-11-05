import { describe, expect, it } from "vite-plus/test";

import type { SidebarThreadSummary } from "../../types";
import { agentCards, runningCount } from "./agentCards";
import { FRAME_TABS, sanitizeFrameTabs, tabFor } from "./frameStore";

const NOW = Date.parse("2026-11-04T12:10:00.000Z");

function thread(id: string, overrides: Record<string, unknown> = {}): SidebarThreadSummary {
  return {
    environmentId: "env",
    id,
    title: `title ${id}`,
    createdAt: "2026-11-04T11:00:00.000Z",
    archivedAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    modelSelection: { instanceId: "claude", model: "opus-5.5" },
    latestRun: null,
    runtime: { status: "idle", activeRunId: null },
    lastVisitedAt: null,
    pendingBackgroundTasks: [],
    lineage: { parentThreadId: null, relationshipToParent: null },
    ...overrides,
  } as unknown as SidebarThreadSummary;
}

const running = (id: string, overrides: Record<string, unknown> = {}) =>
  thread(id, {
    runtime: {
      status: "running",
      activeRunId: "run",
      activityStartedAt: "2026-11-04T12:06:00.000Z",
    },
    ...overrides,
  });

const options = (
  threads: SidebarThreadSummary[],
  subagents: Record<string, SidebarThreadSummary[]> = {},
  agentTypes: Record<string, string> = {},
) => ({
  threads,
  subagentsByParentKey: new Map(Object.entries(subagents)),
  visitedAt: () => undefined,
  agentTypeOf: (t: SidebarThreadSummary) => agentTypes[t.id],
  nowMs: NOW,
});

describe("agentCards", () => {
  it("shows a running thread as a main card with its model and elapsed minutes", () => {
    const [card] = agentCards(options([running("t1")]));
    expect(card).toMatchObject({
      key: "env:t1",
      name: "main",
      meta: "opus-5.5",
      status: "in-progress",
      statusLabel: "in progress · 4m",
      doing: "title t1",
      progress: null,
      subagent: false,
    });
  });

  it("names a live subagent by its type and shows the ticket ID from its title", () => {
    const child = running("c1", {
      title: "A-057 workspace frame",
      lineage: { parentThreadId: "t1", relationshipToParent: "subagent" },
    });
    const cards = agentCards(options([thread("t1")], { "env:t1": [child] }, { c1: "developer" }));
    expect(cards.map((card) => [card.name, card.meta, card.doing, card.subagent])).toEqual([
      ["developer", "A-057", "A-057 workspace frame", true],
    ]);
  });

  it("falls back to 'subagent' when the type is unknown", () => {
    const child = running("c1");
    const [card] = agentCards(options([thread("t1")], { "env:t1": [child] }));
    expect(card?.name).toBe("subagent");
  });

  it("puts needs-you first with the question kind, then running", () => {
    const cards = agentCards(
      options([
        running("t1"),
        thread("t2", { hasPendingApprovals: true }),
        thread("t3", { hasPendingUserInput: true }),
      ]),
    );
    expect(cards.map((card) => [card.key, card.status, card.statusLabel, card.doing])).toEqual([
      ["env:t2", "needs-you", "needs you", "Approval needed"],
      ["env:t3", "needs-you", "needs you", "Waiting for your answer"],
      ["env:t1", "in-progress", "in progress · 4m", "title t1"],
    ]);
  });

  it("uses the latest message's first line for a running main thread", () => {
    const [card] = agentCards(
      options([
        running("t1", {
          source: { latestVisibleMessage: { text: "\n  Writing the tests\nmore" } },
        }),
      ]),
    );
    expect(card?.doing).toBe("Writing the tests");
  });

  it("leaves idle, visited threads out and counts only running agents", () => {
    const cards = agentCards(
      options([thread("idle"), running("t1"), thread("t2", { hasPendingUserInput: true })]),
    );
    expect(cards.map((card) => card.key)).toEqual(["env:t2", "env:t1"]);
    expect(runningCount(cards)).toBe(1);
  });

  it("shows a finished, unseen thread as done at 100%", () => {
    const [card] = agentCards(
      options([
        thread("t1", {
          latestRun: {
            runId: "r",
            status: "completed",
            requestedAt: null,
            startedAt: "2026-11-04T12:00:00.000Z",
            completedAt: "2026-11-04T12:05:00.000Z",
            assistantMessageId: null,
          },
          lastVisitedAt: "2026-11-04T11:00:00.000Z",
        }),
      ]),
    );
    expect(card).toMatchObject({ status: "done", statusLabel: "done", progress: 100 });
  });
});

describe("frame tabs", () => {
  it("defaults a workspace to Jam and reads a saved choice", () => {
    expect(tabFor({ a: "design" }, "a")).toBe("design");
    expect(tabFor({ a: "design" }, "b")).toBe("jam");
    expect(FRAME_TABS).toEqual(["jam", "milestones", "design"]);
  });

  it("drops unknown saved values", () => {
    expect(sanitizeFrameTabs({ tabs: { a: "milestones", b: "nope", c: 3 } })).toEqual({
      a: "milestones",
    });
    expect(sanitizeFrameTabs(null)).toEqual({});
  });
});
