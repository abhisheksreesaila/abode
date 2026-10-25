import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { deriveSessionDetail, sameSessionDetail } from "./sessionDetail";

const run = (id: string, ordinal: number) => ({
  id,
  ordinal,
  status: "running",
  startedAt: DateTime.makeUnsafe("2026-10-17T10:00:00.000Z"),
});
const plan = (runId: string, statuses: string[]) => ({
  kind: "todo_list",
  id: `plan-${runId}`,
  runId,
  steps: statuses.map((status, index) => ({ text: `step ${index}`, status })),
});
const projection = (runs: ReturnType<typeof run>[], plans: ReturnType<typeof plan>[]) =>
  ({
    runs,
    plans,
    turnItems: [],
    subagents: [],
    updatedAt: DateTime.makeUnsafe("2026-10-17T10:00:00.000Z"),
  }) as never;
const noRequests = { approvals: [], userInputs: [] };

describe("deriveSessionDetail", () => {
  it("counts completed steps of the current run's task list", () => {
    const detail = deriveSessionDetail(
      projection([run("r1", 1)], [plan("r1", ["completed", "completed", "running", "pending"])]),
      noRequests,
    );
    expect(detail).toEqual({ progress: { done: 2, total: 4 }, question: null });
  });

  it("has no progress when the agent keeps no task list", () => {
    expect(deriveSessionDetail(projection([run("r1", 1)], []), noRequests).progress).toBeNull();
  });

  it("asks with the first waiting question", () => {
    const detail = deriveSessionDetail(projection([run("r1", 1)], []), {
      approvals: [],
      userInputs: [{ questions: [{ question: "Keep the old card?" }] }] as never,
    });
    expect(detail.question).toBe("Keep the old card?");
  });

  it("describes a waiting approval when there is no question", () => {
    const detail = deriveSessionDetail(projection([run("r1", 1)], []), {
      approvals: [{ detail: "Run rm -rf build" }] as never,
      userInputs: [],
    });
    expect(detail.question).toBe("Run rm -rf build");
    const plain = deriveSessionDetail(projection([run("r1", 1)], []), {
      approvals: [{}] as never,
      userInputs: [],
    });
    expect(plain.question).toBe("Waiting for your approval");
  });
});

describe("sameSessionDetail", () => {
  it("compares counts and question only", () => {
    const base = { progress: { done: 1, total: 3 }, question: null };
    expect(sameSessionDetail(base, { progress: { done: 1, total: 3 }, question: null })).toBe(true);
    expect(sameSessionDetail(base, { progress: { done: 2, total: 3 }, question: null })).toBe(
      false,
    );
    expect(sameSessionDetail(base, { ...base, question: "Q?" })).toBe(false);
    expect(sameSessionDetail(base, { progress: null, question: null })).toBe(false);
  });
});
