import { describe, expect, it } from "vite-plus/test";

import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry, WorkLogEntry } from "~/session-logic";
import { formatWorkSummary, simplifyRowsForMode } from "./simplifyRows";
import { parseTranscriptMode } from "./transcriptMode";

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
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual([
      "u",
      "err",
      "notice",
      "limit",
      "g2:toggle",
      "live",
      "working",
    ]);
  });

  it("keeps a failed single-tool row and drops a successful one", () => {
    const failed = group("f", [{ tone: "tool", toolLifecycleStatus: "failed" }], {
      displayLabel: "Ran x",
    });
    const rows = [failed, group("ok", [{ tone: "tool" }], { displayLabel: "Ran y" })];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["f"]);
  });

  it("keeps an answered question as a record of what was asked", () => {
    const answered = group("q", [{ tone: "tool", questionAnswer: {} as never }], {
      displayLabel: "Answered questions",
    });
    expect(ids(simplifyRowsForMode([answered], [], "calm"))).toEqual(["q"]);
  });

  it("keeps the details row of a kept failed group, including under the thinking row", () => {
    const details = group("g2:details", [{ tone: "tool" }], { isExpandedToolGroup: true });
    expect(ids(simplifyRowsForMode([toggle("g2", true), details], [], "calm"))).toEqual([
      "g2:toggle",
      "g2:details",
    ]);
    const thinking = asRow({ kind: "thinking", id: "t", groupId: "g2" });
    expect(ids(simplifyRowsForMode([thinking, details], [], "calm"))).toEqual(["t", "g2:details"]);
  });

  it("clears continuesWorkLog when the next row was dropped", () => {
    const err = { ...group("err", [{ tone: "info", itemType: "error" }]), continuesWorkLog: true };
    const rows = [err as MessagesTimelineRow, toggle("g")];
    const [out] = simplifyRowsForMode(rows, [], "calm");
    expect(out).toMatchObject({ id: "err", continuesWorkLog: false });
  });

  it("adds call, file and failure counts to a turn fold", () => {
    const entries = [
      tool("t1", "r1", { changedFiles: ["a.ts", "b.ts"] }),
      tool("t2", "r1", { changedFiles: ["a.ts"] }),
      tool("t3", "r1", { toolLifecycleStatus: "failed" }),
      tool("other", "r2"),
    ];
    const [out] = simplifyRowsForMode([fold("r1")], entries, "calm");
    expect(out).toMatchObject({
      label: "Worked for 3m · 3 tool calls · 2 files edited · 1 failed",
    });
  });

  it("leaves a fold without tool work untouched", () => {
    const row = fold("r1");
    expect(simplifyRowsForMode([row], [], "calm")[0]).toBe(row);
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
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual([
      "u1",
      "turn-fold:r1",
      "g1:toggle",
      "w1",
      "a1",
      "u2",
    ]);
  });
});

describe("calm assistant text", () => {
  const meta = (message: string) =>
    asRow({ kind: "assistant-meta", id: `assistant-meta:${message}`, message: { id: message } });
  const err = group("err", [{ tone: "info", itemType: "error" }]);

  it("hides a settled tool turn's text, keeps the fold row and the failure", () => {
    const rows = [
      user("u"),
      fold("r1"),
      assistant("a1"),
      toggle("g"),
      group("step", [{ tone: "tool" }], { displayLabel: "Ran ls" }),
      err,
      assistant("a2"),
      meta("a2"),
    ];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "turn-fold:r1", "err"]);
  });

  it("keeps a settled text-only turn's answer, which has no fold to open", () => {
    const rows = [user("u"), assistant("a")];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "a"]);
  });

  it("keeps only the last answer of a fold-less turn, with its footer", () => {
    const rows = [user("u"), assistant("a1"), assistant("a2"), meta("a2"), meta("a1")];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "a2", "assistant-meta:a2"]);
  });

  it("shows no assistant text while the turn runs", () => {
    const working = asRow({ kind: "working", id: "working" });
    expect(ids(simplifyRowsForMode([user("u"), working, assistant("a")], [], "calm"))).toEqual([
      "u",
      "working",
    ]);
    const streaming = { ...assistant("s"), assistantCopyStreaming: true } as MessagesTimelineRow;
    expect(ids(simplifyRowsForMode([user("u"), streaming], [], "calm"))).toEqual(["u"]);
  });

  it("shows an opened fold's turn in full, text included", () => {
    const rows = [
      user("u1"),
      fold("r1", true),
      assistant("a1"),
      meta("a1"),
      user("u2"),
      assistant("a2"),
    ];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual([
      "u1",
      "turn-fold:r1",
      "a1",
      "assistant-meta:a1",
      "u2",
      "a2",
    ]);
  });

  it("hides the text of other settled turns while one fold is open", () => {
    const rows = [
      user("u1"),
      fold("r1"),
      assistant("a1"),
      user("u2"),
      fold("r2", true),
      assistant("a2"),
    ];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual([
      "u1",
      "turn-fold:r1",
      "u2",
      "turn-fold:r2",
      "a2",
    ]);
  });
});

describe("calm response boundaries", () => {
  const steer = asRow({
    kind: "message",
    id: "steer",
    createdAt: "t",
    message: { role: "user", id: "steer", inputIntent: "steer" },
  });
  const wake = (id: string) => group(id, [{ tone: "info", itemType: "notification" }]);

  it("keeps a text-only answer reachable when a tool-using wake follows", () => {
    const rows = [user("u"), assistant("a1"), wake("n"), fold("r2"), assistant("a2")];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "a1", "n", "turn-fold:r2"]);
  });

  it("shows a text-only wake's answer on its own, not behind the first run's fold", () => {
    const rows = [user("u"), fold("r1"), assistant("a1"), wake("n"), assistant("a2")];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "turn-fold:r1", "n", "a2"]);
  });

  it("does not split a response at a steer message", () => {
    const rows = [user("u"), assistant("a1"), steer, fold("r1"), assistant("a2")];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "steer", "turn-fold:r1"]);
  });

  it("a running wake does not hide an earlier settled answer", () => {
    const rows = [user("u"), assistant("a1"), wake("n"), asRow({ kind: "working", id: "w" })];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual(["u", "a1", "n", "w"]);
  });

  it("an opened fold ends at the next wake", () => {
    const rows = [user("u"), fold("r1", true), assistant("a1"), wake("n"), assistant("a2")];
    expect(ids(simplifyRowsForMode(rows, [], "calm"))).toEqual([
      "u",
      "turn-fold:r1",
      "a1",
      "n",
      "a2",
    ]);
  });
});

describe("parseTranscriptMode", () => {
  it("reads a stored simple as calm, and defaults to calm", () => {
    expect(parseTranscriptMode("simple")).toBe("calm");
    expect(parseTranscriptMode("calm")).toBe("calm");
    expect(parseTranscriptMode("detailed")).toBe("detailed");
    expect(parseTranscriptMode(null)).toBe("calm");
    expect(parseTranscriptMode("nonsense")).toBe("calm");
  });
});

describe("formatWorkSummary", () => {
  it("pluralizes", () => {
    expect(formatWorkSummary("Worked", 1, 1)).toBe("Worked · 1 tool call · 1 file edited");
  });
});
