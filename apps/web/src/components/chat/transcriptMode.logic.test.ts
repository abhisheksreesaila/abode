import { describe, expect, it } from "vite-plus/test";
import type { TimelineEntry, WorkLogEntry } from "../../session-logic";
import type { MessagesTimelineRow } from "./MessagesTimeline.logic";
import {
  DEFAULT_TRANSCRIPT_MODE,
  formatWorkSummary,
  parseTranscriptMode,
  resolveTurnFoldClick,
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

  it("simple attaches the turn's tool entries as steps, in order", () => {
    const fold = simplifyRowsForMode(rows, entries, "simple", true).find((r) => r.id === "fold");
    expect(fold?.kind === "turn-fold" && fold.steps?.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("outside Fluent no steps are derived", () => {
    const fold = simplifyRowsForMode(rows, entries, "simple").find((r) => r.id === "fold");
    expect(fold?.kind === "turn-fold" && fold.steps).toBeFalsy();
  });

  it("detailed rows carry no steps", () => {
    expect(simplifyRowsForMode(rows, entries, "detailed")).toBe(rows);
  });

  it("formats singular counts and omits zeros", () => {
    expect(formatWorkSummary("Worked", 1, 1)).toBe("Worked · 1 tool call · 1 file edited");
    expect(formatWorkSummary("Worked", 0, 0)).toBe("Worked");
  });

  it("keeps the expanded details under a live row and a failed toggle, drops other details", () => {
    const detail = (groupId: string) =>
      row({
        kind: "work",
        id: `${groupId}:details`,
        isExpandedToolGroup: true,
        groupedEntries: [workEntry("d")],
      });
    const input: MessagesTimelineRow[] = [
      row({ kind: "work-toggle", id: "ok-toggle", groupId: "ok", hasFailure: false }),
      detail("ok"),
      row({ kind: "work-live", id: "live", groupId: "g1" }),
      detail("g1"),
      row({ kind: "work-toggle", id: "bad-toggle", groupId: "g2", hasFailure: true }),
      detail("g2"),
    ];
    expect(simplifyRowsForMode(input, [], "simple").map((r) => r.id)).toEqual([
      "live",
      "g1:details",
      "bad-toggle",
      "g2:details",
    ]);
  });

  it("counts failures and ignores superseded or neutral entries in the summary", () => {
    const failing = [
      workTimeline(workEntry("ok", { label: "Read a", toolCallId: "1" })),
      workTimeline(
        workEntry("bad", {
          label: "Run b",
          toolCallId: "2",
          tone: "tool",
          toolLifecycleStatus: "failed",
        }),
      ),
    ];
    const fold = simplifyRowsForMode(rows, failing, "simple").find((r) => r.id === "fold");
    expect(fold).toMatchObject({ label: expect.stringContaining("2 tool calls") });
    expect(fold).toMatchObject({ label: expect.stringContaining("1 failed") });
  });

  it("formats a failure count", () => {
    expect(formatWorkSummary("Worked", 3, 0, 1)).toBe("Worked \u00b7 3 tool calls \u00b7 1 failed");
  });

  it("fold click in Simple opens Detailed with the turn expanded; in Detailed it toggles", () => {
    expect(resolveTurnFoldClick("simple", false)).toEqual({
      switchToDetailed: true,
      expanded: true,
    });
    expect(resolveTurnFoldClick("simple", true)).toEqual({
      switchToDetailed: true,
      expanded: true,
    });
    expect(resolveTurnFoldClick("detailed", true)).toEqual({
      switchToDetailed: false,
      expanded: false,
    });
    expect(resolveTurnFoldClick("detailed", false)).toEqual({
      switchToDetailed: false,
      expanded: true,
    });
  });
});
