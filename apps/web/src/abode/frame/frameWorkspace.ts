/** The workspace group that owns a project (a thread's, or a draft's). */
export function workspaceOf<
  T extends {
    readonly project: {
      readonly memberProjectRefs: ReadonlyArray<{
        readonly environmentId: string;
        readonly projectId: string;
      }>;
    };
  },
>(
  groups: ReadonlyArray<T>,
  ref: { readonly environmentId: string; readonly projectId: string } | null,
): T | undefined {
  if (ref === null) return undefined;
  return groups.find((group) =>
    group.project.memberProjectRefs.some(
      (member) => member.environmentId === ref.environmentId && member.projectId === ref.projectId,
    ),
  );
}
