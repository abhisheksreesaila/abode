import { describe, expect, it } from "vite-plus/test";

import { archivedItems } from "./archivedRail";

const archived = (id: string, archivedAt: string | null, isSubagent = false) => ({
  environmentId: "env",
  id,
  title: `thread ${id}`,
  projectTitle: "abode",
  archivedAt,
  createdAt: "2026-11-01T00:00:00.000Z",
  isSubagent,
});

describe("archivedItems", () => {
  it("lists hidden workspaces first, then archived threads newest first, without subagents", () => {
    const items = archivedItems({
      hiddenWorkspaces: [{ key: "p1", name: "ablearn" }],
      archivedThreads: [
        archived("old", "2026-11-02T00:00:00.000Z"),
        archived("sub", "2026-11-04T00:00:00.000Z", true),
        archived("new", "2026-11-03T00:00:00.000Z"),
        archived("unknown", null),
      ],
    });
    expect(items.map((item) => [item.kind, item.key, item.name])).toEqual([
      ["workspace", "p1", "ablearn"],
      ["thread", "env:new", "thread new"],
      ["thread", "env:old", "thread old"],
      ["thread", "env:unknown", "thread unknown"],
    ]);
  });

  it("is empty when nothing is archived", () => {
    expect(archivedItems({ hiddenWorkspaces: [], archivedThreads: [] })).toEqual([]);
  });
});
