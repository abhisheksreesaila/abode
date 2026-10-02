import { describe, expect, it } from "vite-plus/test";
import type { WorkLogEntry } from "../../session-logic";
import { deriveTurnSteps, stepFromWorkEntry, turnStepsEqual } from "./turnSteps.logic";

const entry = (id: string, patch: Partial<WorkLogEntry> = {}): WorkLogEntry => ({
  id,
  createdAt: "2026-01-01T00:00:00.000Z",
  label: "Ran command",
  tone: "tool",
  ...patch,
});

describe("stepFromWorkEntry", () => {
  it("puts the command in inline code after the label", () => {
    const step = stepFromWorkEntry(entry("a", { command: "pnpm test" }), false);
    expect(step.status).toBe("done");
    expect(step.parts).toEqual([
      { text: "Ran command ", code: false },
      { text: "pnpm test", code: true },
    ]);
  });

  it("uses the first changed file when there is no command", () => {
    const step = stepFromWorkEntry(
      entry("a", { label: "Edited", changedFiles: ["src/a.ts"] }),
      false,
    );
    expect(step.parts.at(-1)).toEqual({ text: "src/a.ts", code: true });
  });

  it("honors backticks already in the label and does not repeat the subject", () => {
    const step = stepFromWorkEntry(entry("a", { label: "Read `x.ts`", command: "x.ts" }), false);
    expect(step.parts).toEqual([
      { text: "Read ", code: false },
      { text: "x.ts", code: true },
    ]);
  });

  it("marks in-progress as unfinished (neutral) and failures as failed", () => {
    expect(stepFromWorkEntry(entry("a", { toolLifecycleStatus: "inProgress" }), false).status).toBe(
      "unfinished",
    );
    expect(stepFromWorkEntry(entry("a"), true).status).toBe("failed");
  });

  it("truncates long commands", () => {
    const step = stepFromWorkEntry(entry("a", { command: "x".repeat(200) }), false);
    expect(step.parts.at(-1)!.text.length).toBeLessThanOrEqual(48);
  });
});

describe("deriveTurnSteps and equality", () => {
  it("keeps entry order and compares by content", () => {
    const a = deriveTurnSteps([entry("1"), entry("2", { toolTitle: "Edited" })], () => false);
    const b = deriveTurnSteps([entry("1"), entry("2", { toolTitle: "Edited" })], () => false);
    expect(a.map((s) => s.id)).toEqual(["1", "2"]);
    expect(turnStepsEqual(a, b)).toBe(true);
    expect(turnStepsEqual(a, b.slice(1))).toBe(false);
  });

  it("detects status and text changes, and treats undefined pairs", () => {
    const base = deriveTurnSteps([entry("1", { label: "A" })], () => false);
    const failed = deriveTurnSteps([entry("1x", { label: "A" })], () => true);
    const renamed = deriveTurnSteps([entry("1", { label: "B" })], () => false);
    expect(turnStepsEqual(base, failed)).toBe(false);
    expect(turnStepsEqual(base, renamed)).toBe(false);
    expect(turnStepsEqual(undefined, undefined)).toBe(true);
    expect(turnStepsEqual(base, undefined)).toBe(false);
  });

  it("builds each entry's step once", () => {
    const e = entry("c");
    expect(deriveTurnSteps([e], () => false)[0]).toBe(deriveTurnSteps([e], () => false)[0]);
  });
});
