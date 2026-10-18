/**
 * With no session open (the Control room, settings), Customizations borrow the workspace
 * of the most recently active session so the section keeps working.
 */
export function pickFallbackThread<
  T extends {
    readonly archivedAt: string | null;
    readonly latestUserMessageAt: string | null;
    readonly updatedAt: string;
    readonly createdAt: string;
    readonly lineage: { readonly relationshipToParent?: string | null };
  },
>(threads: ReadonlyArray<T>): T | null {
  const activity = (thread: T) =>
    thread.latestUserMessageAt ?? thread.updatedAt ?? thread.createdAt;
  return threads
    .filter(
      (thread) => thread.archivedAt === null && thread.lineage.relationshipToParent !== "subagent",
    )
    .reduce<T | null>(
      (best, thread) => (best === null || activity(thread) > activity(best) ? thread : best),
      null,
    );
}
