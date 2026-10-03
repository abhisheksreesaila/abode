import { describe, expect, it } from "vite-plus/test";

import { changedFileRows, changesPanelState } from "./changesList";

type File = { path: string; insertions: number; deletions: number; deleted?: boolean };
const status = (files: File[]) => ({
  isRepo: true,
  workingTree: {
    files,
    insertions: files.reduce((sum, file) => sum + file.insertions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
  },
});

describe("changedFileRows", () => {
  it("is empty without a status, outside a repo, or with a clean tree", () => {
    expect(changedFileRows(null).rows).toEqual([]);
    expect(changedFileRows({ ...status([]), isRepo: false }).rows).toEqual([]);
    expect(changedFileRows(status([])).rows).toEqual([]);
  });

  it("splits each path into name and directory and keeps the +/- counts", () => {
    const summary = changedFileRows(
      status([
        { path: "src/b/z.ts", insertions: 3, deletions: 1 },
        { path: "README.md", insertions: 2, deletions: 0 },
      ]),
    );
    expect(summary.rows).toEqual([
      {
        path: "README.md",
        name: "README.md",
        directory: "",
        insertions: 2,
        deletions: 0,
        kind: "file",
      },
      {
        path: "src/b/z.ts",
        name: "z.ts",
        directory: "src/b/",
        insertions: 3,
        deletions: 1,
        kind: "file",
      },
    ]);
    expect(summary.insertions).toBe(5);
    expect(summary.deletions).toBe(1);
  });

  it("labels untracked directories as folders and deleted files as deleted", () => {
    const summary = changedFileRows(
      status([
        { path: "new-dir/", insertions: 0, deletions: 0 },
        { path: "src/gone.ts", insertions: 0, deletions: 9, deleted: true },
        { path: "src/edited.ts", insertions: 0, deletions: 4 },
      ]),
    );
    expect(summary.rows.map((row) => [row.path, row.kind])).toEqual([
      ["new-dir", "folder"],
      ["src/edited.ts", "file"],
      ["src/gone.ts", "deleted"],
    ]);
  });

  it("makes repo-root paths relative to a subdirectory workspace and drops outside changes", () => {
    const summary = changedFileRows(
      status([
        { path: "apps/web/src/a.ts", insertions: 1, deletions: 0 },
        { path: "apps/web/new/", insertions: 0, deletions: 0 },
        { path: "apps/server/b.ts", insertions: 7, deletions: 7 },
        { path: "package.json", insertions: 1, deletions: 1 },
      ]),
      { workspaceRoot: "/repo/apps/web", repositoryRoot: "/repo" },
    );
    expect(summary.rows.map((row) => [row.path, row.kind])).toEqual([
      ["new", "folder"],
      ["src/a.ts", "file"],
    ]);
    expect(summary.insertions).toBe(1);
    expect(summary.deletions).toBe(0);
  });

  it("leaves paths alone when the workspace is the repository root or a worktree", () => {
    const files = [{ path: "src/a.ts", insertions: 1, deletions: 0 }];
    expect(
      changedFileRows(status(files), { workspaceRoot: "/repo", repositoryRoot: "/repo" }).rows[0]
        ?.path,
    ).toBe("src/a.ts");
    expect(changedFileRows(status(files), { workspaceRoot: "/wt" }).rows[0]?.path).toBe("src/a.ts");
  });
});

describe("changesPanelState", () => {
  it("is loading until the status answers, and an error when the query failed", () => {
    expect(changesPanelState(undefined, null)).toEqual({ kind: "loading" });
    expect(changesPanelState(null, null)).toEqual({ kind: "loading" });
    expect(changesPanelState(undefined, "boom")).toEqual({ kind: "error", message: "boom" });
  });

  it("says not a repository when the status says so", () => {
    expect(changesPanelState({ isRepo: false, workingTree: status([]).workingTree }, null)).toEqual(
      {
        kind: "not-repo",
      },
    );
  });

  it("is clean only for a known-empty status, and lists rows otherwise", () => {
    expect(changesPanelState(status([]), null)).toEqual({ kind: "clean" });
    const state = changesPanelState(status([{ path: "a.ts", insertions: 1, deletions: 0 }]), null);
    expect(state.kind).toBe("changes");
  });

  it("keeps showing known data when a refresh fails", () => {
    expect(changesPanelState(status([]), "boom")).toEqual({ kind: "clean" });
  });
});
