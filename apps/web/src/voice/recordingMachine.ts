/**
 * Pure state machine for one dictation: idle -> recording -> transcribing -> idle.
 * The hook performs the side effects (mic, worker); the machine only decides what
 * state we are in, what to insert, and whether captured audio must be dropped.
 */
export type RecordingState =
  | { status: "idle" }
  | {
      status: "recording";
      /** Muted live preview of the words heard so far. */ interim?: string;
      downloadProgress?: number;
    }
  | { status: "transcribing"; downloadProgress: number | null }
  | { status: "error"; message: string };

export type RecordingEvent =
  | { type: "start" }
  | { type: "stop" }
  | { type: "interim"; text: string }
  | { type: "cancel" }
  | { type: "progress"; fraction: number }
  | { type: "transcribed"; text: string }
  | { type: "failed"; message: string }
  | { type: "dismiss" };

export interface RecordingTransition {
  state: RecordingState;
  /** Transcript to put in the composer. */
  insert?: string;
  /** The recorder should throw away what it captured. */
  discardAudio?: boolean;
}

export const idleState: RecordingState = { status: "idle" };
export const EMPTY_TRANSCRIPT_MESSAGE = "Didn't catch anything. Try again.";

export function reduceRecording(state: RecordingState, event: RecordingEvent): RecordingTransition {
  switch (event.type) {
    case "start":
      return state.status === "idle" || state.status === "error"
        ? { state: { status: "recording" } }
        : { state };
    case "stop":
      return state.status === "recording"
        ? { state: { status: "transcribing", downloadProgress: null } }
        : { state };
    case "interim":
      return state.status === "recording"
        ? { state: { status: "recording", interim: event.text } }
        : { state };
    case "cancel":
      return state.status === "recording" || state.status === "transcribing"
        ? { state: idleState, discardAudio: true }
        : { state };
    case "progress":
      // The first interim job may be the one downloading the model, while still recording.
      if (state.status === "recording") {
        return {
          state: state.interim ? state : { status: "recording", downloadProgress: event.fraction },
        };
      }
      return state.status === "transcribing"
        ? { state: { status: "transcribing", downloadProgress: event.fraction } }
        : { state };
    case "transcribed": {
      if (state.status !== "transcribing") return { state };
      const text = event.text.trim();
      return text.length === 0
        ? { state: { status: "error", message: EMPTY_TRANSCRIPT_MESSAGE } }
        : { state: idleState, insert: text };
    }
    case "failed":
      return { state: { status: "error", message: event.message }, discardAudio: true };
    case "dismiss":
      return state.status === "error" ? { state: idleState } : { state };
  }
}
