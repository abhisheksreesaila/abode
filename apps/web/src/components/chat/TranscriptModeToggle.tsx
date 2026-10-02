import { memo } from "react";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { parseTranscriptMode } from "./transcriptMode.logic";
import { useTranscriptModeStore } from "./transcriptModeStore";

/** Simple / Detailed segmented control for the chat header. */
export const TranscriptModeToggle = memo(function TranscriptModeToggle() {
  const mode = useTranscriptModeStore((store) => store.mode);
  const setMode = useTranscriptModeStore((store) => store.setMode);
  return (
    <ToggleGroup
      aria-label="Transcript detail"
      value={[mode]}
      onValueChange={(next) => {
        // Base UI lets the pressed item be un-pressed; keep exactly one selected.
        const picked = next[0];
        if (picked !== undefined) setMode(parseTranscriptMode(picked));
      }}
    >
      <Toggle value="simple" size="compact" aria-label="Simple transcript">
        Simple
      </Toggle>
      <Toggle value="detailed" size="compact" aria-label="Detailed transcript">
        Detailed
      </Toggle>
    </ToggleGroup>
  );
});
