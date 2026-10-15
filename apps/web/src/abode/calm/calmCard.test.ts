import { describe, expect, it } from "vite-plus/test";

import { buildCalmCard, type CalmSubagent } from "./calmCard";

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
