import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../../lib/storage";
import { sanitizeVoiceBackMode, type VoiceBackMode } from "./voiceBack";

interface VoiceBackStore {
  readonly mode: VoiceBackMode;
  setMode: (mode: VoiceBackMode) => void;
}

/** Per-device, client-only; key moments until the user changes it. */
export const useVoiceBackStore = create<VoiceBackStore>()(
  persist((set) => ({ mode: "key", setMode: (mode) => set({ mode }) }), {
    name: "abode:canvas-voice-back:v1",
    version: 1,
    storage: createJSONStorage(() =>
      resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
    ),
    merge: (persisted, current) => ({
      ...current,
      mode: sanitizeVoiceBackMode((persisted as { mode?: unknown } | null)?.mode),
    }),
    partialize: ({ mode }) => ({ mode }),
  }),
);
