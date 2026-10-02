import { describe, expect, it } from "vite-plus/test";
import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import {
  DEFAULT_TRANSCRIPT_MODE,
  filterTimelineEntriesForMode,
  parseTranscriptMode,
} from "./transcriptMode.logic";

const at = "2026-01-01T00:00:00.000Z";

function message(id: string, role: "user" | "assistant" | "system" | "reasoning"): TimelineEntry {
  return {
    id,
    kind: "message",
    createdAt: at,
    message: { id, role, text: "x", createdAt: at, streaming: false },
  } as unknown as TimelineEntry;
}

function work(id: string, patch: Partial<WorkLogEntry> = {}): TimelineEntry {
  return {
    id,
    kind: "work",
    createdAt: at,
    entry: { id, createdAt: at, label: "Read file", tone: "tool", ...patch },
  };
}

const plan = {
  id: "plan",
  kind: "proposed-plan",
  createdAt: at,
  proposedPlan: {},
} as unknown as TimelineEntry;

const entries: TimelineEntry[] = [
  message("user", "user"),
  message("thinking", "reasoning"),
  work("read"),
  work("thought", { tone: "thinking" }),
  work("note", { tone: "info" }),
  plan,
  work("spawn", { agentSpawn: { workflowId: null, agentTaskIds: ["a"] } }),
  work("answer", { questionAnswer: {} as never }),
  work("boom", { tone: "error" }),
  work("compact", { sourceActivityKind: "context-compaction" }),
  message("assistant", "assistant"),
];

describe("filterTimelineEntriesForMode", () => {
  it("defaults to simple", () => {
    expect(DEFAULT_TRANSCRIPT_MODE).toBe("simple");
    expect(parseTranscriptMode("nonsense")).toBe("simple");
    expect(parseTranscriptMode("detailed")).toBe("detailed");
  });

  it("detailed keeps everything and returns the same array", () => {
    expect(filterTimelineEntriesForMode(entries, "detailed")).toBe(entries);
  });

  it("simple keeps messages, plans, questions, subagents, errors and compaction", () => {
    const ids = filterTimelineEntriesForMode(entries, "simple").map((entry) => entry.id);
    expect(ids).toEqual(["user", "plan", "spawn", "answer", "boom", "compact", "assistant"]);
  });

  it("simple returns the same array when nothing is hidden", () => {
    const clean = [message("u", "user"), message("a", "assistant")];
    expect(filterTimelineEntriesForMode(clean, "simple")).toBe(clean);
  });
});
