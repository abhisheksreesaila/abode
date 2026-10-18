import { describe, expect, it } from "vite-plus/test";

import {
  batchRunIds,
  buildPlanTable,
  currentWork,
  formatDuration,
  type PlanTableMessage,
  type PlanTableStep,
  type PlanTableSubagent,
} from "./planTable";

const MIN = 60_000;

const step = (text: string, status: PlanTableStep["status"], durationMs?: number): PlanTableStep =>
  durationMs === undefined ? { step: text, status } : { step: text, status, durationMs };

const agent = (
  over: Partial<PlanTableSubagent> & { status: PlanTableSubagent["status"] },
): PlanTableSubagent => ({
  id: "s",
  title: "",
  prompt: "",
  startedAtMs: null,
  completedAtMs: null,
  ...over,
});

const say = (text: string, over: Partial<PlanTableMessage> = {}): PlanTableMessage => ({
  role: "assistant",
  runId: "r1",
  text,
  streaming: false,
  ...over,
});

const base = {
  steps: [] as PlanTableStep[],
  subagents: [] as PlanTableSubagent[],
  messages: [] as PlanTableMessage[],
  batch: new Set(["r1"]),
  runsSettled: false,
  needsYou: null as string | null,
};

describe("formatDuration", () => {
  it("reads like the design: seconds, minutes, hours", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(12 * MIN)).toBe("12m");
    expect(formatDuration(72 * MIN)).toBe("1h 12m");
    expect(formatDuration(60 * MIN)).toBe("1h");
    expect(formatDuration(400)).toBe("<1s");
  });
});

describe("buildPlanTable rows", () => {
  it("turns each task into a row with its ticket ID split off and a status", () => {
    const table = buildPlanTable({
      ...base,
      steps: [
        step("A-032: Board data", "completed"),
        step("A-033: Workspace tiles", "inProgress"),
        step("A-034: Phone layout", "pending"),
      ],
    });
    expect(table.rows).toEqual([
      {
        key: "0",
        id: "A-032",
        task: "Board data",
        status: "done",
        who: "main agent",
        durationMs: null,
      },
      {
        key: "1",
        id: "A-033",
        task: "Workspace tiles",
        status: "in-progress",
        who: "main agent",
        durationMs: null,
      },
      {
        key: "2",
        id: "A-034",
        task: "Phone layout",
        status: "not-started",
        who: "main agent",
        durationMs: null,
      },
    ]);
  });

  it("keeps a task without a ticket ID whole, and uses the step's own duration", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("Write the changelog", "completed", 9 * MIN)],
    });
    expect(table.rows).toEqual([
      {
        key: "0",
        id: null,
        task: "Write the changelog",
        status: "done",
        who: "main agent",
        durationMs: 9 * MIN,
      },
    ]);
  });

  it("names the subagent whose title or prompt holds the ticket ID, by type, with its time", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("A-032: Board data", "completed"), step("A-033: Tiles", "inProgress")],
      subagents: [
        agent({
          id: "a",
          title: "Build A-032",
          agentType: "developer",
          status: "completed",
          startedAtMs: 0,
          completedAtMs: 12 * MIN,
        }),
        agent({
          id: "b",
          prompt: "Implement ticket A-033 now",
          agentType: "Reviewer",
          status: "running",
          startedAtMs: 5,
        }),
      ],
    });
    expect(table.rows.map((r) => [r.id, r.who, r.durationMs])).toEqual([
      ["A-032", "developer", 12 * MIN],
      ["A-033", "reviewer", null],
    ]);
  });

  it("calls a Codex subagent without a type a helper", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("A-040: Thing", "inProgress")],
      subagents: [agent({ title: "A-040", status: "running" })],
    });
    expect(table.rows[0]?.who).toBe("helper");
  });

  it("does not match A-03 inside A-033", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("A-03: Short", "inProgress")],
      subagents: [agent({ title: "A-033", agentType: "developer", status: "running" })],
    });
    expect(table.rows[0]?.who).toBe("main agent");
  });

  it("shows the latest of two subagents on one ticket (developer, then reviewer)", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("A-034: Table model", "inProgress")],
      subagents: [
        agent({
          id: "r",
          title: "Review A-034",
          agentType: "reviewer",
          status: "running",
          startedAtMs: 20 * MIN,
        }),
        agent({
          id: "d",
          title: "Build A-034",
          agentType: "developer",
          status: "completed",
          startedAtMs: 0,
          completedAtMs: 15 * MIN,
        }),
      ],
    });
    expect(table.rows[0]).toMatchObject({ who: "reviewer", durationMs: null });
  });

  it("marks the row of a waiting subagent as needing you", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("A-034: A", "inProgress"), step("A-035: B", "inProgress")],
      subagents: [agent({ title: "A-035", agentType: "developer", status: "waiting" })],
      needsYou: "Which one?",
    });
    expect(table.rows.map((r) => r.status)).toEqual(["in-progress", "needs-you"]);
  });

  it("falls back to the first in-progress row when you are needed and no subagent waits", () => {
    const table = buildPlanTable({
      ...base,
      steps: [
        step("A: done", "completed"),
        step("B: now", "inProgress"),
        step("C: also", "inProgress"),
      ],
      needsYou: "Which one?",
    });
    expect(table.rows.map((r) => r.status)).toEqual(["done", "needs-you", "in-progress"]);
  });
});

describe("buildPlanTable header and end state", () => {
  it("counts done of total with a percentage", () => {
    const table = buildPlanTable({
      ...base,
      steps: [
        step("a", "completed"),
        step("b", "completed"),
        step("c", "inProgress"),
        step("d", "pending"),
        step("e", "pending"),
      ],
    });
    expect(table.progress).toEqual({ done: 2, total: 5, percent: 40 });
    expect(table.state).toBe("working");
  });

  it("lists agents still running by type, Codex ones as helper", () => {
    const table = buildPlanTable({
      ...base,
      subagents: [
        agent({ agentType: "developer", status: "running" }),
        agent({ agentType: "Developer", status: "pending" }),
        agent({ agentType: "reviewer", status: "waiting" }),
        agent({ agentType: "developer", status: "completed" }),
        agent({ status: "running" }),
      ],
    });
    expect(table.agentsRunning).toEqual([
      { type: "developer", count: 2 },
      { type: "reviewer", count: 1 },
      { type: "helper", count: 1 },
    ]);
  });

  it("has no table and no percentage for a session without a task list", () => {
    const table = buildPlanTable({
      ...base,
      subagents: [agent({ status: "running", agentType: "explore" })],
    });
    expect(table.rows).toEqual([]);
    expect(table.progress).toBeNull();
    expect(table.state).toBe("working");
    expect(table.finalMessage).toBeNull();
  });

  it("is needs-you while a question waits, and carries its text", () => {
    const table = buildPlanTable({
      ...base,
      steps: [step("a", "inProgress")],
      needsYou: "Keep the old card?",
    });
    expect(table.state).toBe("needs-you");
    expect(table.needsYou).toBe("Keep the old card?");
  });

  it("is settled once every run in the batch and every subagent is finished", () => {
    const steps = [step("a", "completed"), step("b", "completed")];
    expect(buildPlanTable({ ...base, steps, runsSettled: true }).state).toBe("settled");
    expect(buildPlanTable({ ...base, steps, runsSettled: false }).state).toBe("working");
    expect(
      buildPlanTable({
        ...base,
        steps,
        runsSettled: true,
        subagents: [agent({ status: "running" })],
      }).state,
    ).toBe("working");
  });

  it("says complete only when every task is done", () => {
    const done = buildPlanTable({ ...base, steps: [step("a", "completed")], runsSettled: true });
    const partial = buildPlanTable({
      ...base,
      steps: [step("a", "completed"), step("b", "pending")],
      runsSettled: true,
    });
    expect([done.complete, partial.complete]).toEqual([true, false]);
  });

  it("shows the last assistant message across the batch, wake runs included, once settled", () => {
    const messages = [
      say("early", { runId: "r0" }),
      say("middle", { runId: "r1" }),
      say("The final word.", { runId: "r2" }),
      say("", { runId: "r2" }),
    ];
    const batch = new Set(["r1", "r2"]);
    expect(buildPlanTable({ ...base, batch, messages, runsSettled: true }).finalMessage).toBe(
      "The final word.",
    );
    expect(
      buildPlanTable({ ...base, batch, messages, runsSettled: false }).finalMessage,
    ).toBeNull();
  });

  it("ignores user messages and a message still streaming", () => {
    const messages = [
      say("Answer", { runId: "r1" }),
      say("typing...", { runId: "r1", streaming: true }),
      say("question", { runId: "r1", role: "user" }),
    ];
    expect(buildPlanTable({ ...base, messages, runsSettled: true }).finalMessage).toBe("Answer");
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
  const steps = (...statuses: PlanTableStep["status"][]) =>
    statuses.map((status) => ({ step: "x", status }));

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
