import { Option } from "effect";
import { useEffect, useRef } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useEnvironmentThread } from "~/state/threads";

import type { SessionPill } from "../sessionPills";
import type { CanvasWorkspace } from "../useCanvasWorkspaces";
import {
  detectMoments,
  latestFinishedId,
  nextVoiceBackMode,
  replyToSpeak,
  snapshotSessions,
  speechText,
  VOICE_BACK_LABEL,
  type SessionSnapshot,
} from "./voiceBack";
import { useVoiceBackStore } from "./voiceBackStore";

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || text === "") return;
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/** Speaks key moments (a session needs you, is blocked or landed) from the canvas's own pill data. */
export function useKeyMomentSpeech(workspaces: ReadonlyArray<CanvasWorkspace>) {
  const previous = useRef<ReadonlyMap<string, SessionSnapshot>>(new Map());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- speaks through the browser's speech synthesis when session state changes
  useEffect(() => {
    const next = snapshotSessions(workspaces);
    const lines = detectMoments(previous.current, next);
    previous.current = next;
    if (useVoiceBackStore.getState().mode === "off") return;
    for (const line of lines) speak(line);
  }, [workspaces]);
}

/** Mounted while the drawer is open (keyed by session): reads out its newest finished reply in two-way mode. */
export function DrawerReplySpeaker(props: { readonly pill: SessionPill }) {
  const { pill } = props;
  const state = useEnvironmentThread(pill.environmentId, pill.threadId);
  const projection = Option.getOrNull(state.data);
  const seen = useRef<string | null | undefined>(undefined);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- speaks a finished assistant reply through the browser's speech synthesis
  useEffect(() => {
    if (!projection) return;
    const messages = projection.messages;
    if (seen.current === undefined) {
      seen.current = latestFinishedId(messages);
      return;
    }
    const reply = replyToSpeak(messages, seen.current);
    if (!reply) return;
    seen.current = reply.id;
    if (useVoiceBackStore.getState().mode === "two") speak(speechText(reply.text));
  }, [projection]);
  return null;
}

/** Icon-only voice back control: off (dimmed), key moments (amber speaker), two-way (filled amber). */
export function VoiceBackButton() {
  const mode = useVoiceBackStore((state) => state.mode);
  const label = VOICE_BACK_LABEL[mode];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-cvo-tb={mode}
            aria-label={`Voice back: ${label}`}
            onClick={() => {
              const next = nextVoiceBackMode(mode);
              if (next === "off" && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
              }
              useVoiceBackStore.getState().setMode(next);
            }}
          />
        }
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 10v4h4l5 4V6L8 10H4Z" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
        </svg>
      </TooltipTrigger>
      <TooltipPopup>Voice back: {label} (tap to change)</TooltipPopup>
    </Tooltip>
  );
}
