import { describe, expect, it } from "vite-plus/test";

import {
  batchRunIds,
  buildCalmCard,
  currentWork,
  type CalmStep,
  type CalmSubagent,
} from "./calmCard";

const agent = (status: CalmSubagent["status"], agentType?: string): CalmSubagent =>
  agentType === undefined ? { status } : { status, agentType };

describe("buildCalmCard", () => {
  it("is null when there is nothing to show", () => {
    expect(buildCalmCard({ steps: [], subagents: [], needsYou: false })).toBeNull();
  });

  it("still shows a card that only says the thread needs you", () => {
    expect(buildCalmCard({ steps: [], subagents: [], needsYou: true })).toEqual({
      tickets: null,
      agents: [],
      moreAgentTypes: 0,
      needsYou: true,
    });
  });

  it("counts tickets done of total from the task list", () => {
    const card = buildCalmCard({
      steps: [
        { status: "completed" },
        { status: "completed" },
        { status: "inProgress" },
        { status: "pending" },
      ],
      subagents: [],
      needsYou: false,
    });
    expect(card?.tickets).toEqual({ done: 2, total: 4, allDone: false });
  });

  it("marks the tickets all done when every step is completed", () => {
    const card = buildCalmCard({
      steps: [{ status: "completed" }, { status: "completed" }],
      subagents: [],
      needsYou: false,
    });
    expect(card?.tickets).toEqual({ done: 2, total: 2, allDone: true });
  });

  it("groups subagents by type, finished of started, in first-seen order", () => {
    const card = buildCalmCard({
      steps: [],
      subagents: [
        agent("completed", "developer"),
        agent("completed", "reviewer"),
        agent("running", "developer"),
        agent("completed", "developer"),
        agent("running", "reviewer"),
      ],
      needsYou: false,
    });
    expect(card?.agents).toEqual([
      { type: "developer", emoji: "🛠️", finished: 2, started: 3, done: false },
      { type: "reviewer", emoji: "🔍", finished: 1, started: 2, done: false },
    ]);
  });

  it("checks a type off once all of its subagents have finished, failed ones included", () => {
    const card = buildCalmCard({
      steps: [],
      subagents: [agent("completed", "Explore"), agent("failed", "explore")],
      needsYou: false,
    });
    expect(card?.agents).toEqual([
      { type: "explore", emoji: "🧭", finished: 2, started: 2, done: true },
    ]);
  });

  it("names subagents without a type (Codex) helper", () => {
    const card = buildCalmCard({
      steps: [],
      subagents: [agent("running"), agent("completed", "")],
      needsYou: false,
    });
    expect(card?.agents).toEqual([
      { type: "helper", emoji: "🤖", finished: 1, started: 2, done: false },
    ]);
  });

  it("gives unknown types the robot", () => {
    const card = buildCalmCard({
      steps: [],
      subagents: [agent("running", "general-purpose")],
      needsYou: false,
    });
    expect(card?.agents[0]).toMatchObject({ type: "general-purpose", emoji: "🤖" });
  });

  it("shows six types and folds the rest into a count", () => {
    const types = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const card = buildCalmCard({
      steps: [],
      subagents: types.map((type) => agent("running", type)),
      needsYou: false,
    });
    expect(card?.agents.map((row) => row.type)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(card?.moreAgentTypes).toBe(2);
  });
});

describe("batchRunIds", () => {
  const run = (
    id: string,
    ordinal: number,
    wake = false,
    status = "completed",
    startedAt: string | null = "2026-10-14T19:00:00Z",
  ) =>
    wake
      ? { id, ordinal, status, startedAt, workStartedAt: "2026-10-14T20:00:00Z" }
      : { id, ordinal, status, startedAt };

  it("is the user's latest run plus every wake after it", () => {
    const ids = batchRunIds([run("r1", 1), run("r2", 2), run("r3", 3, true), run("r4", 4, true)]);
    expect([...ids].toSorted()).toEqual(["r2", "r3", "r4"]);
  });

  it("orders by ordinal, not by array position", () => {
    const ids = batchRunIds([run("r3", 3, true), run("r1", 1), run("r2", 2)]);
    expect([...ids].toSorted()).toEqual(["r2", "r3"]);
  });

  it("skips queued runs: a wake waiting in line is not stamped yet", () => {
    const ids = batchRunIds([
      run("r2", 2, false, "running"),
      run("r3", 3, true),
      run("r4", 4, false, "queued", null),
    ]);
    expect([...ids].toSorted()).toEqual(["r2", "r3"]);
  });

  it("skips a queued message turned into a steer (cancelled, never started)", () => {
    const ids = batchRunIds([
      run("r2", 2, false, "running"),
      run("r3", 3, false, "cancelled", null),
    ]);
    expect([...ids]).toEqual(["r2"]);
  });

  it("lets a user run that is about to start begin a new batch", () => {
    const ids = batchRunIds([
      run("r2", 2, false, "running"),
      run("r3", 3, false, "starting", null),
    ]);
    expect([...ids]).toEqual(["r3"]);
  });

  it("is empty for a thread without runs", () => {
    expect(batchRunIds([]).size).toBe(0);
  });
});

describe("currentWork", () => {
  const batch = new Set(["r2", "r3"]);
  const steps = (...statuses: CalmStep["status"][]) => statuses.map((status) => ({ status }));

  it("keeps a task list written in this batch, finished or not", () => {
    expect(
      currentWork({ batch, plan: { runId: "r2", steps: steps("completed") }, subagents: [] }).steps,
    ).toHaveLength(1);
  });

  it("drops a task list from before the user's latest message, even an unfinished one", () => {
    expect(
      currentWork({ batch, plan: { runId: "r1", steps: steps("pending") }, subagents: [] }).steps,
    ).toEqual([]);
  });

  it("counts subagents spawned anywhere in the batch, while a wake runs", () => {
    const work = currentWork({
      batch,
      plan: null,
      subagents: [
        { runId: "r1", status: "completed" },
        { runId: "r2", status: "running" },
        { runId: "r2", status: "completed" },
        { runId: "r3", status: "running" },
      ],
    });
    expect(work.subagents).toHaveLength(3);
  });
});
