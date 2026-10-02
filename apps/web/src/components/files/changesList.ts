import type { VcsStatusResult } from "@t3tools/contracts";

export interface ChangedFileRow {
  path: string;
  name: string;
  /** Directory part with a trailing slash, or "" for a file at the root. */
  directory: string;
  insertions: number;
  deletions: number;
}

export interface ChangesSummary {
  rows: ReadonlyArray<ChangedFileRow>;
  insertions: number;
  deletions: number;
}

const EMPTY_CHANGES: ChangesSummary = { rows: [], insertions: 0, deletions: 0 };

/** The working-tree changes the client already has from the VCS status, as list rows. */
export function changedFileRows(
  status: Pick<VcsStatusResult, "isRepo" | "workingTree"> | null | undefined,
): ChangesSummary {
  if (!status || !status.isRepo || status.workingTree.files.length === 0) return EMPTY_CHANGES;
  const rows = status.workingTree.files
    .map((file): ChangedFileRow => {
      const slash = file.path.lastIndexOf("/");
      return {
        path: file.path,
        name: file.path.slice(slash + 1),
        directory: slash < 0 ? "" : file.path.slice(0, slash + 1),
        insertions: file.insertions,
        deletions: file.deletions,
      };
    })
    .toSorted((a, b) => a.path.localeCompare(b.path));
  return {
    rows,
    insertions: status.workingTree.insertions,
    deletions: status.workingTree.deletions,
  };
}
