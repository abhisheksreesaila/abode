export type ArchivedItem =
  | { readonly kind: "workspace"; readonly key: string; readonly name: string }
  | {
      readonly kind: "thread";
      readonly key: string;
      readonly name: string;
      /** The workspace the thread belongs to, for the second line. */
      readonly workspace: string;
      readonly environmentId: string;
      readonly threadId: string;
    };

/**
 * The rail's "Archived" list: hidden workspaces first (they bring their threads back with
 * them), then archived threads, newest archive first. Subagent threads are never listed.
 */
export function archivedItems(input: {
  readonly hiddenWorkspaces: ReadonlyArray<{ readonly key: string; readonly name: string }>;
  readonly archivedThreads: ReadonlyArray<{
    readonly environmentId: string;
    readonly id: string;
    readonly title: string;
    readonly projectTitle: string;
    readonly archivedAt: string | null;
    readonly createdAt: string;
    readonly isSubagent: boolean;
  }>;
}): ArchivedItem[] {
  const threads = input.archivedThreads
    .filter((thread) => !thread.isSubagent)
    .toSorted((a, b) => (b.archivedAt ?? b.createdAt).localeCompare(a.archivedAt ?? a.createdAt))
    .map((thread): ArchivedItem => ({
      kind: "thread",
      key: `${thread.environmentId}:${thread.id}`,
      name: thread.title,
      workspace: thread.projectTitle,
      environmentId: thread.environmentId,
      threadId: thread.id,
    }));
  return [
    ...input.hiddenWorkspaces.map((workspace): ArchivedItem => ({
      kind: "workspace",
      key: workspace.key,
      name: workspace.name,
    })),
    ...threads,
  ];
}
