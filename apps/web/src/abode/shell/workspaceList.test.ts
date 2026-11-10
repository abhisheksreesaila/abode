import { describe, expect, it } from "vite-plus/test";

import {
  threadListWindow,
  resolveWorkspacePill,
  splitLatestThreads,
  threadMetaLabel,
  threadSquareTone,
  type ThreadAttention,
  workspacePillView,
  visibleWorkspaceThreads,
  jumpOrderKeys,
  sessionPlace,
} from "./workspaceList";

describe("resolveWorkspacePill", () => {
  const t = (attention: ThreadAttention, failed = false) => ({
    attention,
    failed: failed,
  });
  it("is null when nothing is happening", () => {
    expect(resolveWorkspacePill([t(null), t(null)])).toBeNull();
  });
  it("counts background-task waits as running", () => {
    expect(resolveWorkspacePill([t("running"), t("running")])).toMatchObject({
      kind: "running",
      count: 2,
    });
  });
  it("shows a done pill for unseen completions, below everything else", () => {
    expect(resolveWorkspacePill([t("done")])).toMatchObject({ kind: "done", label: "done" });
    expect(resolveWorkspacePill([t("done"), t("running")])?.kind).toBe("running");
  });
  it("counts running threads", () => {
    expect(resolveWorkspacePill([t("running"), t("running"), t(null)])).toMatchObject({
      kind: "running",
      count: 2,
      label: "2 running",
    });
  });
  it("ranks needs-you over failed over running, listing all in the detail", () => {
    const pill = resolveWorkspacePill([t("running"), t(null, true), t("needs-you")]);
    expect(pill).toMatchObject({ kind: "needs-you", label: "1 needs you" });
    expect(pill?.detail).toBe("1 needs you, failed, 1 running");
    expect(resolveWorkspacePill([t("running"), t(null, true)])?.label).toBe("failed");
  });
});

describe("splitLatestThreads", () => {
  it("shows everything when there are two or fewer", () => {
    expect(splitLatestThreads([1, 2])).toEqual({ shown: [1, 2], olderCount: 0 });
  });
  it("shows the latest two and counts the rest", () => {
    expect(splitLatestThreads([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2], olderCount: 3 });
  });
  it("keeps the active thread visible", () => {
    expect(splitLatestThreads([1, 2, 3, 4, 5], { isActive: (n) => n === 4 })).toEqual({
      shown: [1, 2, 4],
      olderCount: 2,
    });
  });
});

describe("threadListWindow", () => {
  it("offers nothing extra for two or fewer threads", () => {
    expect(threadListWindow([1, 2], { expanded: false })).toEqual({
      shown: [1, 2],
      olderCount: 0,
      showMore: false,
      showLess: false,
    });
  });
  it("offers +N older when collapsed, and Show less when expanded", () => {
    expect(threadListWindow([1, 2, 3, 4], { expanded: false })).toMatchObject({
      shown: [1, 2],
      olderCount: 2,
      showMore: true,
      showLess: false,
    });
    expect(threadListWindow([1, 2, 3, 4], { expanded: true })).toMatchObject({
      shown: [1, 2, 3, 4],
      showMore: false,
      showLess: true,
    });
  });
  it("never offers +0 older when the active thread is the only hidden one", () => {
    const window = threadListWindow([1, 2, 3], { expanded: false, isActive: (n) => n === 3 });
    expect(window).toMatchObject({ shown: [1, 2, 3], olderCount: 0, showMore: false });
  });
});

describe("threadSquareTone", () => {
  it("maps thread status labels to the three squares plus done", () => {
    expect(threadSquareTone("running")).toBe("running");
    expect(threadSquareTone("running")).toBe("running");
    expect(threadSquareTone("running")).toBe("running");
    expect(threadSquareTone("needs-you")).toBe("needs-you");
    expect(threadSquareTone("needs-you")).toBe("needs-you");
    expect(threadSquareTone("done")).toBe("done");
    expect(threadSquareTone(null)).toBe("idle");
  });
  it("turns red for a failed run, but never hides something waiting on you", () => {
    expect(threadSquareTone(null, true)).toBe("failed");
    expect(threadSquareTone("done", true)).toBe("failed");
    expect(threadSquareTone("needs-you", true)).toBe("needs-you");
    expect(threadSquareTone("running", true)).toBe("running");
  });
  it("swaps the age for a state word only while it applies", () => {
    expect(threadMetaLabel("needs-you", "2m")).toBe("Needs you");
    expect(threadMetaLabel("running", "2m")).toBe("2m");
    expect(threadMetaLabel("failed", "2m")).toBe("failed");
  });
});

describe("workspacePillView", () => {
  it("shows a count pill, and a red failed marker for failures", () => {
    expect(
      workspacePillView({ kind: "needs-you", count: 2, label: "2 needs you", detail: "" }),
    ).toEqual({ kind: "count", tone: "needs-you", text: "2" });
    expect(workspacePillView({ kind: "failed", count: 1, label: "failed", detail: "" })).toEqual({
      kind: "failed",
      text: "\u2297 failed",
    });
  });
});

describe("visibleWorkspaceThreads", () => {
  const keyOf = (n: number) => `t${n}`;
  const base = { showAll: false, latest: 2, activeKey: null as string | null, keyOf };

  it("shows the latest few and hides the rest behind older", () => {
    const result = visibleWorkspaceThreads([1, 2, 3, 4], { ...base, expanded: true });
    expect(result.rows).toEqual([1, 2]);
    expect(result.window.olderCount).toBe(2);
  });

  it("keeps the open session in a collapsed workspace and nothing else", () => {
    const result = visibleWorkspaceThreads([1, 2, 3, 4], {
      ...base,
      expanded: false,
      activeKey: "t4",
    });
    expect(result.rows).toEqual([4]);
  });

  it("shows everything once older is opened", () => {
    expect(
      visibleWorkspaceThreads([1, 2, 3, 4], { ...base, expanded: true, showAll: true }).rows,
    ).toEqual([1, 2, 3, 4]);
  });

  it("keeps the open session visible even when it is an older one", () => {
    expect(
      visibleWorkspaceThreads([1, 2, 3, 4], { ...base, expanded: true, activeKey: "t4" }).rows,
    ).toEqual([1, 2, 4]);
  });
});

describe("jumpOrderKeys", () => {
  it("is exactly the rows the sidebar renders, workspace by workspace", () => {
    const keyOf = (n: number) => `t${n}`;
    const workspaces = [
      { threads: [1, 2, 3, 4], expanded: true, showAll: false },
      { threads: [5, 6], expanded: false, showAll: false },
      { threads: [7, 8, 9], expanded: true, showAll: true },
    ];
    const options = { latest: 2, activeKey: "t6", keyOf };
    const rendered = workspaces.flatMap(
      (w) =>
        visibleWorkspaceThreads(w.threads, { ...options, expanded: w.expanded, showAll: w.showAll })
          .rows,
    );
    expect(rendered).toEqual([1, 2, 6, 7, 8, 9]);
    expect(jumpOrderKeys(workspaces, options)).toEqual(rendered.map(keyOf));
  });
});

describe("sessionPlace", () => {
  it("is a worktree when the session has a worktree path", () => {
    expect(sessionPlace({ worktreePath: "/w/abode-A-019", branch: "A-019-calm" })).toEqual({
      kind: "worktree",
      branch: "A-019-calm",
    });
  });

  it("is the workspace folder otherwise, with its branch when known", () => {
    expect(sessionPlace({ worktreePath: null, branch: "main" })).toEqual({
      kind: "local",
      branch: "main",
    });
    expect(sessionPlace({ worktreePath: "  ", branch: null })).toEqual({
      kind: "local",
      branch: null,
    });
  });
});
