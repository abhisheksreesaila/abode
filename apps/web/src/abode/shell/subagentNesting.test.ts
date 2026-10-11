import { describe, expect, it } from "vite-plus/test";

import {
  SIDEBAR_SUBAGENT_VISIBLE_LIMIT,
  nestRunningSubagents,
  subagentOverflow,
  type SubagentNestingThread,
} from "./subagentNesting";

let seq = 0;
function thread(
  id: string,
  overrides: Partial<{
    parent: string | null;
    relationship: string | null;
    status: string | null;
    approval: boolean;
    input: boolean;
    archived: boolean;
    env: string;
  }> = {},
): SubagentNestingThread {
  seq += 1;
  const parent = overrides.parent ?? null;
  return {
    environmentId: overrides.env ?? "env",
    id,
    title: `title ${id}`,
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString(),
    archivedAt: overrides.archived ? "2026-10-02T00:00:00Z" : null,
    hasPendingApprovals: overrides.approval ?? false,
    hasPendingUserInput: overrides.input ?? false,
    runtime: overrides.status === null ? null : { status: overrides.status ?? "running" },
    lineage: {
      parentThreadId: parent,
      relationshipToParent: overrides.relationship ?? (parent ? "subagent" : null),
    },
  } as unknown as SubagentNestingThread;
}

const ids = (threads: ReadonlyArray<{ id: string }> | undefined) => threads?.map((t) => t.id);

describe("nestRunningSubagents", () => {
  it("separates subagent threads from top-level threads", () => {
    const root = thread("root", { status: "idle" });
    const child = thread("child", { parent: "root" });
    const result = nestRunningSubagents([root, child]);
    expect(ids(result.topLevel)).toEqual(["root"]);
    expect(ids(result.runningByParentKey.get("env:root"))).toEqual(["child"]);
  });

  it("drops subagents that are not running", () => {
    const root = thread("root");
    const done = thread("done", { parent: "root", status: "idle" });
    const failed = thread("failed", { parent: "root", status: "failed" });
    const result = nestRunningSubagents([root, done, failed]);
    expect(ids(result.topLevel)).toEqual(["root"]);
    expect(result.runningByParentKey.size).toBe(0);
  });

  it("keeps a subagent that is waiting on the user", () => {
    const root = thread("root");
    const asking = thread("asking", { parent: "root", status: "idle", input: true });
    const approving = thread("approving", { parent: "root", status: "idle", approval: true });
    const result = nestRunningSubagents([root, asking, approving]);
    expect(ids(result.runningByParentKey.get("env:root"))).toEqual(["asking", "approving"]);
  });

  it("flattens nested subagents under the nearest top-level thread", () => {
    const root = thread("root", { status: "idle" });
    const mid = thread("mid", { parent: "root" });
    const leaf = thread("leaf", { parent: "mid" });
    const result = nestRunningSubagents([root, mid, leaf]);
    expect(ids(result.runningByParentKey.get("env:root"))).toEqual(["mid", "leaf"]);
  });

  it("nests a running grandchild even when its parent subagent finished", () => {
    const root = thread("root", { status: "idle" });
    const mid = thread("mid", { parent: "root", status: "idle" });
    const leaf = thread("leaf", { parent: "mid" });
    const result = nestRunningSubagents([root, mid, leaf]);
    expect(ids(result.runningByParentKey.get("env:root"))).toEqual(["leaf"]);
  });

  it("keeps environments apart", () => {
    const rootA = thread("root", { env: "a", status: "idle" });
    const rootB = thread("root", { env: "b", status: "idle" });
    const childB = thread("child", { env: "b", parent: "root" });
    const result = nestRunningSubagents([rootA, rootB, childB]);
    expect(result.runningByParentKey.has("a:root")).toBe(false);
    expect(ids(result.runningByParentKey.get("b:root"))).toEqual(["child"]);
  });

  it("ignores archived subagents and orphans, and does not loop on a cycle", () => {
    const root = thread("root");
    const archived = thread("archived", { parent: "root", archived: true });
    const orphan = thread("orphan", { parent: "missing" });
    const a = thread("a", { parent: "b" });
    const b = thread("b", { parent: "a" });
    const result = nestRunningSubagents([root, archived, orphan, a, b]);
    expect(ids(result.topLevel)).toEqual(["root"]);
    expect(result.runningByParentKey.size).toBe(0);
  });

  it("does not treat forks as subagents", () => {
    const root = thread("root");
    const fork = thread("fork", { parent: "root", relationship: "fork" });
    const result = nestRunningSubagents([root, fork]);
    expect(ids(result.topLevel)).toEqual(["root", "fork"]);
    expect(result.runningByParentKey.size).toBe(0);
  });

  it("orders children by creation time", () => {
    const root = thread("root");
    const first = thread("first", { parent: "root" });
    const second = thread("second", { parent: "root" });
    const result = nestRunningSubagents([root, second, first]);
    expect(ids(result.runningByParentKey.get("env:root"))).toEqual(["first", "second"]);
  });
});

describe("subagentOverflow", () => {
  it("shows up to the limit and summarizes the rest", () => {
    const items = Array.from({ length: SIDEBAR_SUBAGENT_VISIBLE_LIMIT + 3 }, (_, i) => i);
    expect(subagentOverflow(items)).toEqual({
      shown: items.slice(0, SIDEBAR_SUBAGENT_VISIBLE_LIMIT),
      moreCount: 3,
    });
    expect(subagentOverflow([1, 2])).toEqual({ shown: [1, 2], moreCount: 0 });
  });
});
