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
): MessagesTimelineRow[] {
  const mode = useTranscriptModeStore((store) => store.mode);
  return useMemo(() => simplifyRowsForMode(rows, entries, mode), [rows, entries, mode]);
}
