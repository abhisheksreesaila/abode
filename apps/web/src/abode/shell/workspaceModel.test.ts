import { describe, expect, it } from "vite-plus/test";

import {
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

  it("skips empty, already-sent and currently open drafts", () => {
    const rows = visibleDraftRows({
      sessions: {
        empty: session("2026-10-01"),
        sent: session("2026-10-01", "thread-1"),
        open: session("2026-10-01"),
        kept: session("2026-10-01"),
      },
      composers: {
        empty: { prompt: "" },
        sent: { prompt: "x" },
        open: { prompt: "x" },
        kept: { prompt: "x" },
      },
      routeDraftId: "open",
      hasContent,
    });
    expect(rows.map((row) => row.draftId)).toEqual(["kept"]);
  });

  it("skips a session with no composer state", () => {
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
