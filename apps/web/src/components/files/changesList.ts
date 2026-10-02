import type { VcsStatusResult } from "@t3tools/contracts";

import { resolveDiffPathForWorkspace } from "~/diffFileActions";

export interface ChangedFileRow {
  /** Relative to the panel's workspace root, without a trailing slash. */
  path: string;
  name: string;
  /** Directory part with a trailing slash, or "" for a file at the root. */
  directory: string;
  insertions: number;
  deletions: number;
  /** `folder` is an untracked directory git reports as one entry; it has no diff to open. */
  kind: "file" | "deleted" | "folder";
}

export interface ChangesSummary {
  rows: ReadonlyArray<ChangedFileRow>;
  insertions: number;
  deletions: number;
}

const EMPTY_CHANGES: ChangesSummary = { rows: [], insertions: 0, deletions: 0 };

/**
 * The working-tree changes the client already has from the VCS status, as list
 * rows. Git reports paths relative to the repository root, so when the
 * workspace is a subdirectory of the repo (`repositoryRoot` is then the
 * project's repository root) they are made relative to it and changes outside
 * it are left out.
 */
export function changedFileRows(
  status: Pick<VcsStatusResult, "isRepo" | "workingTree"> | null | undefined,
  scope: { workspaceRoot?: string | undefined; repositoryRoot?: string | undefined } = {},
): ChangesSummary {
  if (!status || !status.isRepo || status.workingTree.files.length === 0) return EMPTY_CHANGES;
  const rows: ChangedFileRow[] = [];
  for (const file of status.workingTree.files) {
    const path = resolveDiffPathForWorkspace({
      filePath: file.path,
      workspaceRoot: scope.workspaceRoot,
      repositoryRoot: scope.repositoryRoot,
    });
    if (path === null) continue;
    const slash = path.lastIndexOf("/");
    rows.push({
      path,
      name: path.slice(slash + 1),
      directory: slash < 0 ? "" : path.slice(0, slash + 1),
      insertions: file.insertions,
      deletions: file.deletions,
      kind: file.path.endsWith("/") ? "folder" : file.deleted ? "deleted" : "file",
    });
  }
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return {
    rows,
    insertions: rows.reduce((sum, row) => sum + row.insertions, 0),
    deletions: rows.reduce((sum, row) => sum + row.deletions, 0),
  };
}
