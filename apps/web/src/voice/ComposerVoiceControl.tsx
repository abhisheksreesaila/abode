import { useEffect, useState } from "react";
import { MicIcon, SquareIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import type { RecordingState } from "./recordingMachine";
import { previewLabel } from "./previewText";
import { voiceShortcutLabel } from "./shortcut";
import { useVoiceDictation } from "./useVoiceDictation";
import { useVoiceSettings } from "./voiceSettings";

export function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Whole seconds since recording began; ticks at 1 Hz so it never repaints continuously. */
function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [active]);
  return seconds;
}

export function describeVoiceStatus(state: RecordingState, elapsedSeconds = 0): string | null {
  switch (state.status) {
    case "idle":
      return null;
    case "recording":
      return `Listening ${formatElapsed(elapsedSeconds)} · Release to insert · Esc cancel`;
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
export function ComposerVoiceControl({
  onTranscript,
  disabled = false,
}: {
  /** Returns false when the composer could not take the text. */
  onTranscript: (text: string) => boolean;
  /** The composer cannot accept text right now (connecting, approval, pending question). */
  disabled?: boolean;
}) {
  const { settings } = useVoiceSettings();
  const { state, toggle } = useVoiceDictation({
    enabled: settings.enabled,
    canStart: !disabled,
    shortcut: settings.shortcut,
    onTranscript,
  });
  const recording = state.status === "recording";
  const elapsed = useElapsedSeconds(recording);
  if (!settings.enabled) return null;

  const status = describeVoiceStatus(state, elapsed);
  const busy = state.status === "transcribing";
  const label = recording ? "Stop dictation" : "Dictate";
  const preview = state.status === "recording" ? previewLabel(state) : null;
  return (
    <div className="relative flex items-center gap-2">
      {preview ? (
        // Muted ghost of what has been heard so far; the real text lands on release.
        <p
          data-voice-interim="true"
          className="pointer-events-none absolute right-0 bottom-full mb-2 w-72 max-w-[70vw] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs italic text-muted-foreground shadow-sm"
        >
          {preview}
        </p>
      ) : null}
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
              disabled={busy || (disabled && !recording)}
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
    </div>
  );
}
