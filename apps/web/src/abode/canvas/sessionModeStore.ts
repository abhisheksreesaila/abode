import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import { DEFAULT_MODE, sanitizeModes, type SessionMode } from "./sessionMode";

const MODES_STORAGE_KEY = "abode:canvas-modes:v1";

interface SessionModeStore {
  /** Only sessions off the default are stored. */
  readonly modes: Readonly<Record<string, SessionMode>>;
  /** Serious mode: hides the mascots' quips. */
  readonly serious: boolean;
  setMode: (sessionKey: string, mode: SessionMode) => void;
  setSerious: (serious: boolean) => void;
}

export const modeOf = (modes: Readonly<Record<string, SessionMode>>, key: string): SessionMode =>
  modes[key] ?? DEFAULT_MODE;

/** Per-device, client-only; never sent to the server. */
export const useSessionModeStore = create<SessionModeStore>()(
  persist(
    (set) => ({
      modes: {},
      serious: false,
      setMode: (sessionKey, mode) =>
        set((state) => {
          const { [sessionKey]: _old, ...rest } = state.modes;
          return { modes: mode === DEFAULT_MODE ? rest : { ...rest, [sessionKey]: mode } };
        }),
      setSerious: (serious) => set({ serious }),
    }),
    {
      name: MODES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({
        ...current,
        modes: sanitizeModes((persisted as { modes?: unknown } | null)?.modes),
        serious: (persisted as { serious?: unknown } | null)?.serious === true,
      }),
      partialize: ({ modes, serious }) => ({ modes, serious }),
    },
  ),
);
