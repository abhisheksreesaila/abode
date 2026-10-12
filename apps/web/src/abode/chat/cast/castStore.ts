import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../../lib/storage";
import { DEFAULT_CAST, sanitizeCast, type BossLook, type CastSettings } from "./bossConfig";

export const CAST_STORAGE_KEY = "abode:cast:v1";

export type CastPatch = Partial<Omit<CastSettings, "look">> & { readonly look?: Partial<BossLook> };

interface CastStore extends CastSettings {
  /** Merges into the current settings (the look part by part), so quick changes all land. */
  update: (patch: CastPatch) => void;
}

/** Per-user, client-only; never sent to the server. */
export const useCastStore = create<CastStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CAST,
      update: (patch) =>
        set((state) =>
          sanitizeCast({ ...state, ...patch, look: { ...state.look, ...patch.look } }),
        ),
    }),
    {
      name: CAST_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({ ...current, ...sanitizeCast(persisted) }),
      partialize: ({ update: _update, ...settings }) => settings,
    },
  ),
);
