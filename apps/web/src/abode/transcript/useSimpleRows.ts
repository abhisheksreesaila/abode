import { useMemo } from "react";

import type { MessagesTimelineRow } from "~/components/chat/MessagesTimeline.logic";
import type { TimelineEntry } from "~/session-logic";
import { simplifyRowsForMode } from "./simplifyRows";
import { useTranscriptModeStore } from "./transcriptModeStore";

/**
 * Applies the Simple/Detailed mode to upstream's derived rows. Detailed hands
 * back the same array, so it costs nothing; Simple recomputes only when the
 * rows do, and the stable-rows pass downstream keeps unchanged rows identical.
 */
export function useSimpleRows(
  rows: MessagesTimelineRow[],
  entries: ReadonlyArray<TimelineEntry>,
  identity: string,
): { rows: MessagesTimelineRow[]; identity: string } {
  const mode = useTranscriptModeStore((store) => store.mode);
  const simple = useMemo(() => simplifyRowsForMode(rows, entries, mode), [rows, entries, mode]);
  // The stable-rows pass ignores spacing flags, so each mode gets its own identity.
  return { rows: simple, identity: `${identity}:${mode}` };
}
