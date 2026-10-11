import type { ContextMenuItem } from "@t3tools/contracts";
import { ScrollTextIcon } from "lucide-react";

import { ITEM_ICON_CLASS, type CommandPaletteActionItem } from "~/components/CommandPalette.logic";
import { otherTranscriptMode, parseTranscriptMode, type TranscriptMode } from "./transcriptMode";
import { useTranscriptModeStore } from "./transcriptModeStore";

const MENU_PREFIX = "abode:transcript:";
export type AbodeTranscriptMenuId = "abode:transcript" | `${typeof MENU_PREFIX}${TranscriptMode}`;

/** "Transcript > Simple / Detailed" submenu for the thread's header menu. */
export function abodeTranscriptMenuItem(): ContextMenuItem<AbodeTranscriptMenuId> {
  const { mode } = useTranscriptModeStore.getState();
  return {
    id: "abode:transcript",
    label: "Transcript",
    icon: "folder-tree",
    separatorBefore: true,
    children: [
      { id: "abode:transcript:simple", label: "Simple", checked: mode === "simple" },
      { id: "abode:transcript:detailed", label: "Detailed", checked: mode === "detailed" },
    ],
  };
}

/** Handles a header-menu pick; returns true when the id was ours. */
export function runAbodeTranscriptMenuAction(id: string): boolean {
  if (!id.startsWith(MENU_PREFIX)) return false;
  useTranscriptModeStore.getState().setMode(parseTranscriptMode(id.slice(MENU_PREFIX.length)));
  return true;
}

/** Command palette row that flips the mode. The title stays neutral: the palette may hold it past a change. */
export function abodeTranscriptAction(): CommandPaletteActionItem {
  return {
    kind: "action",
    value: "action:abode-transcript-mode",
    searchTerms: ["transcript", "simple", "detailed", "tool calls", "verbose", "mode"],
    title: "Toggle simple / detailed transcript",
    icon: <ScrollTextIcon className={ITEM_ICON_CLASS} />,
    run: async () => {
      const { mode, setMode } = useTranscriptModeStore.getState();
      setMode(otherTranscriptMode(mode));
    },
  };
}
