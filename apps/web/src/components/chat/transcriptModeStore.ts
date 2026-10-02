import { create } from "zustand";
import {
  DEFAULT_TRANSCRIPT_MODE,
  parseTranscriptMode,
  type TranscriptMode,
} from "./transcriptMode.logic";

const STORAGE_KEY = "abode:transcript-mode:v1";

function readPersistedMode(): TranscriptMode {
  try {
    return parseTranscriptMode(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_TRANSCRIPT_MODE;
  }
}

interface TranscriptModeStore {
  mode: TranscriptMode;
  setMode: (mode: TranscriptMode) => void;
}

/** Global (not per-thread), client-side only. */
export const useTranscriptModeStore = create<TranscriptModeStore>((set) => ({
  mode: readPersistedMode(),
  setMode: (mode) => {
    set({ mode });
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable: the choice still holds for this session.
    }
  },
}));

export function toggleTranscriptMode() {
  const { mode, setMode } = useTranscriptModeStore.getState();
  setMode(mode === "simple" ? "detailed" : "simple");
}
