import { memo } from "react";

import { MenuGroup, MenuGroupLabel, MenuRadioGroup, MenuRadioItem } from "../ui/menu";
import { parseTranscriptMode } from "./transcriptMode.logic";
import { useTranscriptModeStore } from "./transcriptModeStore";

/** Simple / Detailed as a radio group for the top bar's ⋯ menu (abode F-037). */
export const TranscriptModeMenuItems = memo(function TranscriptModeMenuItems() {
  const mode = useTranscriptModeStore((store) => store.mode);
  const setMode = useTranscriptModeStore((store) => store.setMode);
  return (
    <MenuGroup>
      <MenuGroupLabel>Transcript</MenuGroupLabel>
      <MenuRadioGroup value={mode} onValueChange={(next) => setMode(parseTranscriptMode(next))}>
        <MenuRadioItem value="simple">Simple</MenuRadioItem>
        <MenuRadioItem value="detailed">Detailed</MenuRadioItem>
      </MenuRadioGroup>
    </MenuGroup>
  );
});
