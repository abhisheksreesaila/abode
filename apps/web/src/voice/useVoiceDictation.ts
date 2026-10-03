import { useCallback, useEffect, useRef, useState } from "react";

import { describeMicrophoneError, startRecording, type ActiveRecording } from "./audioRecorder";
import {
  idleState,
  reduceRecording,
  type RecordingEvent,
  type RecordingState,
} from "./recordingMachine";
import { isShortcutRelease, matchesVoiceShortcut } from "./shortcut";
import { startInterimLoop } from "./interimLoop";
import { SPEECH_SAMPLE_RATE } from "./pcmBuffer";
import { transcribe } from "./transcriberClient";

/** Shorter than this is an accidental tap, not speech. */
const MIN_SAMPLES = SPEECH_SAMPLE_RATE * 0.3;
/** How often the audio so far is re-transcribed for the live text. */
const INTERIM_INTERVAL_MS = 1_000;
/**
 * The live text re-reads everything said so far, up to this long. Beyond it only the tail is
 * read and the interim loop prefixes "…", so the first words are never silently dropped.
 */
const INTERIM_WINDOW_SAMPLES = SPEECH_SAMPLE_RATE * 30;
const INTERIM_MIN_SAMPLES = SPEECH_SAMPLE_RATE * 0.5;
const ERROR_VISIBLE_MS = 6_000;
const INSERT_FAILED_MESSAGE = "Can't insert right now.";
const TRANSCRIBE_FAILED_MESSAGE =
  "Couldn't load the speech model. Check your connection and retry.";

/** Only one composer may own a dictation at a time, even when several are mounted. */
let activeOwner: symbol | null = null;

export interface VoiceDictation {
  state: RecordingState;
  /** Tap behavior for the mic button: start, or stop and transcribe. */
  toggle: () => void;
  /** Abandons any dictation in flight without inserting anything. */
  cancel: () => void;
}

/**
 * Drives dictation: mic capture -> worker transcription -> `onTranscript`. The hold-to-talk
 * key is handled on `window` so it works wherever focus is in the app.
 */
export function useVoiceDictation(input: {
  enabled: boolean;
  /** False blocks only new dictations; one already in flight finishes. */
  canStart: boolean;
  shortcut: string;
  /** Returns false when the composer could not take the text. */
  onTranscript: (text: string) => boolean;
}): VoiceDictation {
  const { shortcut } = input;
  const enabled = input.enabled;
  const canStartRef = useRef(input.canStart);
  const [state, setState] = useState<RecordingState>(idleState);
  const stateRef = useRef<RecordingState>(idleState);
  const recorderRef = useRef<ActiveRecording | null>(null);
  const tokenRef = useRef(0);
  const stopInterimRef = useRef<(() => void) | null>(null);
  const ownerRef = useRef(Symbol("voice-dictation"));
  const onTranscriptRef = useRef(input.onTranscript);
  const { onTranscript } = input;
  const { canStart } = input;
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    canStartRef.current = canStart;
  }, [onTranscript, canStart]);

  const send = useCallback((event: RecordingEvent) => {
    const transition = reduceRecording(stateRef.current, event);
    stateRef.current = transition.state;
    setState(transition.state);
    if (transition.state.status !== "recording") {
      stopInterimRef.current?.();
      stopInterimRef.current = null;
    }
    if (transition.discardAudio) {
      recorderRef.current?.discard();
      recorderRef.current = null;
      tokenRef.current += 1;
    }
    if (transition.state.status === "idle" || transition.state.status === "error") {
      if (activeOwner === ownerRef.current) activeOwner = null;
    }
    if (transition.insert !== undefined && !onTranscriptRef.current(transition.insert)) {
      const failed = reduceRecording(stateRef.current, {
        type: "failed",
        message: INSERT_FAILED_MESSAGE,
      });
      stateRef.current = failed.state;
      setState(failed.state);
    }
  }, []);

  const runTranscription = useCallback(
    async (recorder: ActiveRecording, token: number) => {
      let audio: Float32Array;
      try {
        audio = await recorder.finish();
      } catch {
        // Empty or very short audio cannot be decoded; that is "heard nothing", not a model fault.
        if (token === tokenRef.current) send({ type: "transcribed", text: "" });
        return;
      }
      if (token !== tokenRef.current) return;
      try {
        if (audio.length < MIN_SAMPLES) {
          send({ type: "transcribed", text: "" });
          return;
        }
        const text = await transcribe(audio, (fraction) => {
          if (token === tokenRef.current) send({ type: "progress", fraction });
        });
        if (token === tokenRef.current) send({ type: "transcribed", text });
      } catch {
        if (token === tokenRef.current)
          send({ type: "failed", message: TRANSCRIBE_FAILED_MESSAGE });
      }
    },
    [send],
  );

  const begin = useCallback(() => {
    const status = stateRef.current.status;
    if (status !== "idle" && status !== "error") return;
    if (!canStartRef.current) return;
    if (activeOwner !== null && activeOwner !== ownerRef.current) return;
    activeOwner = ownerRef.current;
    send({ type: "start" });
    const token = ++tokenRef.current;
    startRecording().then(
      (recorder) => {
        if (token !== tokenRef.current) {
          recorder.discard();
          return;
        }
        recorderRef.current = recorder;
        if (stateRef.current.status === "recording") {
          stopInterimRef.current = startInterimLoop({
            intervalMs: INTERIM_INTERVAL_MS,
            snapshot: () => recorder.snapshot(INTERIM_WINDOW_SAMPLES, INTERIM_MIN_SAMPLES),
            transcribe: (audio) =>
              transcribe(audio, (fraction) => send({ type: "progress", fraction })),
            onText: (text) => send({ type: "interim", text }),
          });
        }
        // Released before the mic opened: go straight to transcription.
        if (stateRef.current.status === "transcribing") {
          recorderRef.current = null;
          void runTranscription(recorder, token);
        }
      },
      (error: unknown) => {
        if (token === tokenRef.current) {
          send({ type: "failed", message: describeMicrophoneError(error) });
        }
      },
    );
  }, [runTranscription, send]);

  const end = useCallback(() => {
    if (stateRef.current.status !== "recording") return;
    send({ type: "stop" });
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    void runTranscription(recorder, tokenRef.current);
  }, [runTranscription, send]);

  const cancel = useCallback(() => send({ type: "cancel" }), [send]);

  const toggle = useCallback(() => {
    if (stateRef.current.status === "recording") end();
    else begin();
  }, [begin, end]);

  useEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const status = stateRef.current.status;
      if (event.key === "Escape" && (status === "recording" || status === "transcribing")) {
        if (activeOwner !== ownerRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
        return;
      }
      if (!matchesVoiceShortcut(event, shortcut)) return;
      event.preventDefault();
      if (!event.repeat) begin();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (stateRef.current.status === "recording" && isShortcutRelease(event, shortcut)) end();
    };
    // A keyup never arrives if the window loses focus mid-hold.
    const onBlur = () => end();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [begin, cancel, enabled, end, shortcut]);

  useEffect(() => {
    if (state.status !== "error") return;
    const timer = setTimeout(() => send({ type: "dismiss" }), ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [send, state]);

  // Release the mic if the composer unmounts mid-recording.
  useEffect(() => cancel, [cancel]);

  return { state, toggle, cancel };
}
