import { MicIcon, SquareIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import type { RecordingState } from "./recordingMachine";
import { voiceShortcutLabel } from "./shortcut";
import { useVoiceDictation } from "./useVoiceDictation";
import { useVoiceSettings } from "./voiceSettings";

export function describeVoiceStatus(state: RecordingState): string | null {
  switch (state.status) {
    case "idle":
      return null;
    case "recording":
      return "Listening… release to transcribe. Esc cancels.";
    case "transcribing":
      return state.downloadProgress === null
        ? "Transcribing…"
        : `Downloading speech model… ${Math.round(state.downloadProgress * 100)}%`;
    case "error":
      return state.message;
  }
}

/**
 * Mic button and hold-to-talk key for the composer footer. Transcripts go to `onTranscript`
 * and are never sent; the user still presses Enter. Renders nothing when voice is off.
 */
export function ComposerVoiceControl({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { settings } = useVoiceSettings();
  const { state, toggle } = useVoiceDictation({
    enabled: settings.enabled,
    shortcut: settings.shortcut,
    onTranscript,
  });
  if (!settings.enabled) return null;

  const status = describeVoiceStatus(state);
  const recording = state.status === "recording";
  const busy = state.status === "transcribing";
  const label = recording ? "Stop dictation" : "Dictate";
  return (
    <>
      {status ? (
        <span
          role={state.status === "error" ? "alert" : "status"}
          className="flex min-w-0 max-w-56 items-center gap-1.5 truncate text-xs text-muted-foreground"
        >
          {recording ? (
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-destructive" />
          ) : null}
          <span className="truncate">{status}</span>
        </span>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant={recording ? "destructive" : "ghost"}
              size="icon-sm"
              disabled={busy}
              onPointerDown={(event) => event.preventDefault()}
              onClick={toggle}
              aria-label={label}
              aria-pressed={recording}
            />
          }
        >
          {recording ? <SquareIcon /> : <MicIcon />}
        </TooltipTrigger>
        <TooltipPopup>
          {label} (hold {voiceShortcutLabel(settings.shortcut)})
        </TooltipPopup>
      </Tooltip>
    </>
  );
}
