import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";

// v3: stock T3 became the default (2026-11-09), so an old stored "on" no longer applies.
const CANVAS_STORAGE_KEY = "abode:canvas:v3";

interface CanvasStore {
  /** One Window: abode's sidebar, overview, frame, Calm and avatars. Off (the default) is T3's own UI, plus Kit. */
  readonly enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/** Per-device, client-only; never sent to the server. */
export const useCanvasStore = create<CanvasStore>()(
  persist((set) => ({ enabled: false, setEnabled: (enabled) => set({ enabled }) }), {
    name: CANVAS_STORAGE_KEY,
    version: 1,
    storage: createJSONStorage(() =>
      resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
    ),
    merge: (persisted, current) => ({
      ...current,
      enabled: (persisted as { enabled?: unknown } | null)?.enabled === true,
    }),
    partialize: ({ enabled }) => ({ enabled }),
  }),
);
