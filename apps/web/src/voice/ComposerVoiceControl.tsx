import { useEffect, useRef, useState } from "react";
import { MicIcon, SquareIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import type { RecordingState } from "./recordingMachine";
import { provisionalTextFor } from "./provisionalDictation";
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
      return state.downloadProgress === undefined || state.interim
        ? `Listening ${formatElapsed(elapsedSeconds)} · Release to insert · Esc cancel`
        : `Downloading voice model ${Math.round(state.downloadProgress * 100)}%…`;
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
  onProvisionalStart,
  onProvisionalText,
  onProvisionalEnd,
  resetKey,
  disabled = false,
}: {
  /** Changes when the composer moves to another draft; an active dictation is cancelled. */
  resetKey: string;
  /** Recording began: pin the insertion point. */
  onProvisionalStart: () => void;
  /** The live text to show (empty string for none yet). Called at most once per interim tick. */
  onProvisionalText: (text: string) => void;
  /** Dictation ended without a transcript (cancelled or failed): drop the provisional text. */
  onProvisionalEnd: () => void;
  /** Returns false when the composer could not take the text. */
  onTranscript: (text: string) => boolean;
  /** The composer cannot accept text right now (connecting, approval, pending question). */
  disabled?: boolean;
}) {
  const { settings } = useVoiceSettings();
  // Only when the composer cannot take the text is it shown here, so it is never lost.
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const { state, toggle, cancel } = useVoiceDictation({
    enabled: settings.enabled,
    canStart: !disabled,
    shortcut: settings.shortcut,
    onTranscript: (text) => {
      const inserted = onTranscript(text);
      if (!inserted) setFallbackText(text);
      return inserted;
    },
  });
  const handlersRef = useRef({ onProvisionalStart, onProvisionalText, onProvisionalEnd });
  useEffect(() => {
    handlersRef.current = { onProvisionalStart, onProvisionalText, onProvisionalEnd };
  });
  const resetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    cancel();
    setFallbackText(null);
  }, [cancel, resetKey]);
  const previousStatusRef = useRef(state.status);
  useEffect(() => {
    const handlers = handlersRef.current;
    const wasRecording = previousStatusRef.current === "recording";
    previousStatusRef.current = state.status;
    if (state.status === "recording" && !wasRecording) {
      setFallbackText(null);
      handlers.onProvisionalStart();
    }
    const text = provisionalTextFor(state);
    if (text === null) handlers.onProvisionalEnd();
    else if (text !== undefined) handlers.onProvisionalText(text);
  }, [state]);
  const recording = state.status === "recording";
  const elapsed = useElapsedSeconds(recording);
  if (!settings.enabled) return null;

  const status = describeVoiceStatus(state, elapsed);
  const busy = state.status === "transcribing";
  const label = recording ? "Stop dictation" : "Dictate";
  return (
    <div className="relative flex items-center gap-2">
      {fallbackText ? (
        <div
          role="alert"
          className="absolute right-0 bottom-full mb-2 flex w-72 max-w-[70vw] items-start gap-2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm"
        >
          <p className="min-w-0 flex-1 select-text break-words">{fallbackText}</p>
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => setFallbackText(null)}
          >
            Dismiss
          </Button>
        </div>
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
