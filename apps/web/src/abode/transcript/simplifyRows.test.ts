import { describe, expect, it } from "vite-plus/test";

import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry, WorkLogEntry } from "~/session-logic";
import { formatWorkSummary, simplifyRowsForMode } from "./simplifyRows";

const asRow = (row: object) => row as MessagesTimelineRow;
const user = (id: string) =>
  asRow({ kind: "message", id, createdAt: "t", message: { role: "user", id } });
const assistant = (id: string) =>
  asRow({ kind: "message", id, createdAt: "t", message: { role: "assistant", id } });
const group = (id: string, entries: Partial<WorkLogEntry>[], extra: object = {}) =>
  asRow({
    kind: "work",
    id,
    createdAt: "t",
    groupedEntries: entries,
    isExpandedToolGroup: false,
    ...extra,
  });
const toggle = (groupId: string, hasFailure = false) =>
  asRow({ kind: "work-toggle", id: `${groupId}:toggle`, groupId, hasFailure });
const fold = (runId: string, expanded = false) =>
  asRow({ kind: "turn-fold", id: `turn-fold:${runId}`, runId, label: "Worked for 3m", expanded });
const tool = (id: string, runId: string, extra: Partial<WorkLogEntry> = {}) =>
  ({
    kind: "work",
    id,
    createdAt: "t",
    entry: { id, runId, tone: "tool", label: "Ran", toolLifecycleStatus: "completed", ...extra },
  }) as unknown as TimelineEntry;

const ids = (rows: MessagesTimelineRow[]) => rows.map((row) => row.id);

describe("simplifyRowsForMode", () => {
  it("returns the very same array in detailed mode", () => {
    const rows = [user("u"), toggle("g")];
    expect(simplifyRowsForMode(rows, [], "detailed")).toBe(rows);
  });

  it("drops tool steps but keeps messages, live rows and standalone work rows", () => {
    const live = asRow({ kind: "work-live", id: "live", groupId: "gl", groupedEntries: [] });
    const rows = [
      user("u"),
      toggle("g1"),
      group("step", [{ tone: "tool" }], { displayLabel: "Ran ls" }),
      // Real V2 shapes: errors, notices and warnings arrive with tone "info".
      group("err", [{ tone: "info", itemType: "error", sourceActivityKind: "runtime.error" }]),
      group("notice", [{ tone: "info", itemType: "system_notice" }]),
      group("limit", [{ tone: "info", sourceActivityKind: "runtime.warning" }]),
      toggle("g2", true),
      live,
      asRow({ kind: "working", id: "working" }),
      assistant("a"),
    ];
    expect(ids(simplifyRowsForMode(rows, [], "simple"))).toEqual([
      "u",
      "err",
      "notice",
      "limit",
      "g2:toggle",
      "live",
      "working",
      "a",
    ]);
  });

  it("keeps a failed single-tool row and drops a successful one", () => {
    const failed = group("f", [{ tone: "tool", toolLifecycleStatus: "failed" }], {
      displayLabel: "Ran x",
    });
    const rows = [failed, group("ok", [{ tone: "tool" }], { displayLabel: "Ran y" })];
    expect(ids(simplifyRowsForMode(rows, [], "simple"))).toEqual(["f"]);
  });

  it("keeps an answered question as a record of what was asked", () => {
    const answered = group("q", [{ tone: "tool", questionAnswer: {} as never }], {
      displayLabel: "Answered questions",
    });
    expect(ids(simplifyRowsForMode([answered], [], "simple"))).toEqual(["q"]);
  });

  it("keeps the details row of a kept failed group, including under the thinking row", () => {
    const details = group("g2:details", [{ tone: "tool" }], { isExpandedToolGroup: true });
    expect(ids(simplifyRowsForMode([toggle("g2", true), details], [], "simple"))).toEqual([
      "g2:toggle",
      "g2:details",
    ]);
    const thinking = asRow({ kind: "thinking", id: "t", groupId: "g2" });
    expect(ids(simplifyRowsForMode([thinking, details], [], "simple"))).toEqual([
      "t",
      "g2:details",
    ]);
  });

  it("clears continuesWorkLog when the next row was dropped", () => {
    const err = { ...group("err", [{ tone: "info", itemType: "error" }]), continuesWorkLog: true };
    const rows = [err as MessagesTimelineRow, toggle("g")];
    const [out] = simplifyRowsForMode(rows, [], "simple");
    expect(out).toMatchObject({ id: "err", continuesWorkLog: false });
  });

  it("adds call, file and failure counts to a turn fold", () => {
    const entries = [
      tool("t1", "r1", { changedFiles: ["a.ts", "b.ts"] }),
      tool("t2", "r1", { changedFiles: ["a.ts"] }),
      tool("t3", "r1", { toolLifecycleStatus: "failed" }),
      tool("other", "r2"),
    ];
    const [out] = simplifyRowsForMode([fold("r1")], entries, "simple");
    expect(out).toMatchObject({
      label: "Worked for 3m · 3 tool calls · 2 files edited · 1 failed",
    });
  });

  it("leaves a fold without tool work untouched", () => {
    const row = fold("r1");
    expect(simplifyRowsForMode([row], [], "simple")[0]).toBe(row);
  });

  it("shows an expanded fold's turn as Detailed does, until the next user message", () => {
    const rows = [
      user("u1"),
      fold("r1", true),
      toggle("g1"),
      group("w1", [{ tone: "tool" }]),
      assistant("a1"),
      user("u2"),
      toggle("g2"),
    ];
    expect(ids(simplifyRowsForMode(rows, [], "simple"))).toEqual([
      "u1",
      "turn-fold:r1",
      "g1:toggle",
      "w1",
      "a1",
      "u2",
    ]);
  });
});

describe("formatWorkSummary", () => {
  it("pluralizes", () => {
    expect(formatWorkSummary("Worked", 1, 1)).toBe("Worked · 1 tool call · 1 file edited");
  });
});
