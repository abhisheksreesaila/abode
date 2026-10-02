import { describe, expect, it } from "vite-plus/test";

import { changedFileRows } from "./changesList";

const status = (files: Array<{ path: string; insertions: number; deletions: number }>) => ({
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
      { path: "README.md", name: "README.md", directory: "", insertions: 2, deletions: 0 },
      { path: "src/b/z.ts", name: "z.ts", directory: "src/b/", insertions: 3, deletions: 1 },
    ]);
    expect(summary.insertions).toBe(5);
    expect(summary.deletions).toBe(1);
  });
});
