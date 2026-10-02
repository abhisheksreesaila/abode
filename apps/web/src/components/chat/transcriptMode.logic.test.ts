import { describe, expect, it } from "vite-plus/test";
import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import type { MessagesTimelineRow } from "./MessagesTimeline.logic";
import {
  DEFAULT_TRANSCRIPT_MODE,
  formatWorkSummary,
  parseTranscriptMode,
  simplifyRowsForMode,
} from "./transcriptMode.logic";

const at = "2026-01-01T00:00:00.000Z";

function workEntry(id: string, patch: Partial<WorkLogEntry> = {}): WorkLogEntry {
  return { id, createdAt: at, label: "Read file", tone: "tool", turnId: "t1" as never, ...patch };
}

function workTimeline(entry: WorkLogEntry): TimelineEntry {
  return { id: entry.id, kind: "work", createdAt: at, entry };
}

const row = (r: Record<string, unknown>) => ({ createdAt: at, ...r }) as MessagesTimelineRow;

const rows: MessagesTimelineRow[] = [
  row({ kind: "message", id: "user" }),
  row({ kind: "work", id: "read", groupedEntries: [workEntry("read")] }),
  row({ kind: "work", id: "boom", groupedEntries: [workEntry("boom", { tone: "error" })] }),
  row({
    kind: "work",
    id: "spawn",
    groupedEntries: [workEntry("spawn", { agentSpawn: { workflowId: null, agentTaskIds: [] } })],
  }),
  row({ kind: "work-toggle", id: "toggle" }),
  row({ kind: "activity-group", id: "old-trace", active: false }),
  row({ kind: "activity-group", id: "live-trace", active: true }),
  row({ kind: "work-live", id: "live-tool" }),
  row({ kind: "working", id: "working" }),
  row({ kind: "proposed-plan", id: "plan" }),
  row({ kind: "turn-fold", id: "fold", turnId: "t1", label: "Worked for 1m 12s", expanded: false }),
  row({ kind: "message", id: "assistant" }),
];

const entries = [
  workTimeline(workEntry("a", { changedFiles: ["x.ts", "y.ts"] })),
  workTimeline(workEntry("b", { changedFiles: ["y.ts", "z.ts"] })),
  workTimeline(workEntry("c", { tone: "info" })),
  workTimeline(workEntry("other", { turnId: "t2" as never })),
];

describe("simplifyRowsForMode", () => {
  it("defaults to simple", () => {
    expect(DEFAULT_TRANSCRIPT_MODE).toBe("simple");
    expect(parseTranscriptMode("nonsense")).toBe("simple");
    expect(parseTranscriptMode("detailed")).toBe("detailed");
  });

  it("detailed returns the rows untouched", () => {
    expect(simplifyRowsForMode(rows, entries, "detailed")).toBe(rows);
  });

  it("simple drops tool rows and settled traces but keeps live rows, errors and cards", () => {
    const ids = simplifyRowsForMode(rows, entries, "simple").map((r) => r.id);
    expect(ids).toEqual([
      "user",
      "boom",
      "spawn",
      "live-trace",
      "live-tool",
      "working",
      "plan",
      "fold",
      "assistant",
    ]);
  });

  it("simple keeps a work summary with tool call and file counts", () => {
    const fold = simplifyRowsForMode(rows, entries, "simple").find((r) => r.id === "fold");
    expect(fold).toMatchObject({
      label: "Worked for 1m 12s · 2 tool calls · 3 files edited",
    });
  });

  it("formats singular counts and omits zeros", () => {
    expect(formatWorkSummary("Worked", 1, 1)).toBe("Worked · 1 tool call · 1 file edited");
    expect(formatWorkSummary("Worked", 0, 0)).toBe("Worked");
  });
});
