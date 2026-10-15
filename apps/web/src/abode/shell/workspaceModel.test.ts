import { describe, expect, it } from "vite-plus/test";

import {
  draftIdsByWorkspace,
  groupThreadsByWorkspace,
  projectRefKey,
  visibleDraftRows,
  workspaceDisplayName,
} from "./workspaceModel";

const group = (projectKey: string, ...refs: Array<[string, string]>) => ({
  projectKey,
  memberProjectRefs: refs.map(([environmentId, projectId]) => ({ environmentId, projectId })),
});

describe("groupThreadsByWorkspace", () => {
  it("puts threads of every grouped project under one workspace", () => {
    const groups = [
      group("repo", ["local", "p1"], ["remote", "p9"]),
      group("other", ["local", "p2"]),
    ];
    const threads = [
      { id: "a", environmentId: "local", projectId: "p1" },
      { id: "b", environmentId: "remote", projectId: "p9" },
      { id: "c", environmentId: "local", projectId: "p2" },
    ];
    const grouped = groupThreadsByWorkspace(groups, threads);
    expect(grouped.get("repo")?.map((t) => t.id)).toEqual(["a", "b"]);
    expect(grouped.get("other")?.map((t) => t.id)).toEqual(["c"]);
  });

  it("does not confuse equal project ids in different environments", () => {
    const groups = [group("one", ["local", "p"]), group("two", ["remote", "p"])];
    const grouped = groupThreadsByWorkspace(groups, [
      { id: "x", environmentId: "remote", projectId: "p" },
    ]);
    expect(grouped.has("one")).toBe(false);
    expect(grouped.get("two")?.map((t) => t.id)).toEqual(["x"]);
  });

  it("leaves out threads whose project is not listed", () => {
    const grouped = groupThreadsByWorkspace(
      [group("repo", ["local", "p1"])],
      [{ id: "lost", environmentId: "local", projectId: "gone" }],
    );
    expect(grouped.size).toBe(0);
  });

  it("builds the same key everywhere", () => {
    expect(projectRefKey({ environmentId: "e", projectId: "p" })).toBe("e:p");
  });
});

describe("workspaceDisplayName", () => {
  it("calls the scratch project Chats, since it has no folder", () => {
    expect(workspaceDisplayName({ displayName: "scratch-abc", isScratch: true })).toBe("Chats");
  });

  it("keeps a real workspace's own name", () => {
    expect(workspaceDisplayName({ displayName: "t3code", isScratch: false })).toBe("t3code");
  });
});

describe("visibleDraftRows", () => {
  const session = (createdAt: string, promotedTo: unknown = null) => ({
    environmentId: "local",
    projectId: "p1",
    createdAt,
    promotedTo,
  });
  const hasContent = (composer: { prompt: string }) => composer.prompt.length > 0;

  it("lists unsent drafts with content, newest first", () => {
    const rows = visibleDraftRows({
      sessions: { old: session("2026-10-01"), fresh: session("2026-10-02") },
      composers: { old: { prompt: "a" }, fresh: { prompt: "b" } },
      routeDraftId: null,
      hasContent,
    });
    expect(rows.map((row) => row.draftId)).toEqual(["fresh", "old"]);
  });

  it("skips empty and already-sent drafts that are not open", () => {
    const rows = visibleDraftRows({
      sessions: {
        empty: session("2026-10-01"),
        sent: session("2026-10-01", "thread-1"),
        kept: session("2026-10-01"),
      },
      composers: {
        empty: { prompt: "" },
        sent: { prompt: "x" },
        kept: { prompt: "x" },
      },
      routeDraftId: null,
      hasContent,
    });
    expect(rows.map((row) => row.draftId)).toEqual(["kept"]);
  });

  it("shows the open draft even when it is empty or has no composer state yet", () => {
    const sessions = { open: session("2026-10-01"), other: session("2026-10-02") };
    expect(
      visibleDraftRows({
        sessions,
        composers: { open: { prompt: "" }, other: { prompt: "" } },
        routeDraftId: "open",
        hasContent,
      }).map((row) => row.draftId),
    ).toEqual(["open"]);
    expect(
      visibleDraftRows({ sessions, composers: {}, routeDraftId: "open", hasContent }).map(
        (row) => row.draftId,
      ),
    ).toEqual(["open"]);
  });

  it("drops the empty draft's row once another page is open", () => {
    expect(
      visibleDraftRows({
        sessions: { was: session("2026-10-01") },
        composers: { was: { prompt: "" } },
        routeDraftId: null,
        hasContent,
      }),
    ).toEqual([]);
  });

  it("does not show an open draft that was already sent", () => {
    expect(
      visibleDraftRows({
        sessions: { open: session("2026-10-01", "thread-1") },
        composers: {},
        routeDraftId: "open",
        hasContent,
      }),
    ).toEqual([]);
  });

  it("skips a closed session with no composer state", () => {
    expect(
      visibleDraftRows({
        sessions: { a: session("2026-10-01") },
        composers: {},
        routeDraftId: null,
        hasContent,
      }),
    ).toEqual([]);
  });
});

describe("draftIdsByWorkspace", () => {
  const session = (projectId: string, createdAt: string) => ({
    environmentId: "local",
    projectId,
    createdAt,
    promotedTo: null,
  });

  it("files each draft under its workspace, newest first", () => {
    const result = draftIdsByWorkspace({
      groups: [group("a", ["local", "p1"]), group("b", ["local", "p2"])],
      sessions: {
        d1: session("p1", "2026-10-01"),
        d2: session("p1", "2026-10-02"),
        d3: session("p2", "2026-10-01"),
        d4: session("gone", "2026-10-01"),
      },
      composers: {
        d1: { prompt: "x" },
        d2: { prompt: "x" },
        d3: { prompt: "x" },
        d4: { prompt: "x" },
      },
      routeDraftId: null,
      hasContent: () => true,
    });
    expect(result).toEqual({ a: ["d2", "d1"], b: ["d3"] });
  });

  it("files the open empty draft under its workspace", () => {
    const result = draftIdsByWorkspace({
      groups: [group("a", ["local", "p1"])],
      sessions: { d1: session("p1", "2026-10-01") },
      composers: {},
      routeDraftId: "d1",
      hasContent: () => false,
    });
    expect(result).toEqual({ a: ["d1"] });
  });
});
