/** Archiving can succeed and the follow-up navigation still fail; the toast must say which. */
export function archiveFailureTitle(didArchive: boolean): string {
  return didArchive ? "Thread archived, but navigation failed" : "Failed to archive thread";
}
