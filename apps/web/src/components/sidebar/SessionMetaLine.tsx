import { FolderIcon, GitCompareArrowsIcon } from "lucide-react";
import { memo } from "react";

import type { SessionMeta } from "./sessionsSections";

/**
 * The dim second line of a session row (abode F-035): a folder icon and the time,
 * or `+N −M` in green and red when the thread has a diff, then the time.
 */
export const SessionMetaLine = memo(function SessionMetaLine({ diff, label }: SessionMeta) {
  return (
    <span className="flex min-w-0 items-center gap-1 text-3xs tabular-nums text-secondary-label">
      {diff ? (
        <GitCompareArrowsIcon aria-hidden className="size-3 shrink-0" />
      ) : (
        <FolderIcon aria-hidden className="size-3 shrink-0" />
      )}
      {diff ? (
        <>
          <span className="text-success-foreground">+{diff.additions}</span>
          <span className="text-destructive">{`−${diff.deletions}`}</span>
          {label ? <span aria-hidden>·</span> : null}
        </>
      ) : label ? (
        <span aria-hidden>·</span>
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
});
