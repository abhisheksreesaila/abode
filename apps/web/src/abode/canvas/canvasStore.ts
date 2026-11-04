import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";

// v2: One Window became the default (2026-11-03), so an old stored "off" no longer applies.
const CANVAS_STORAGE_KEY = "abode:canvas:v2";

interface CanvasStore {
  /** One Window, on by default: the canvas replaces the Control room on "/". Off is abode as it was. */
  readonly enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/** Per-device, client-only; never sent to the server. */
export const useCanvasStore = create<CanvasStore>()(
  persist((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }), {
    name: CANVAS_STORAGE_KEY,
    version: 1,
    storage: createJSONStorage(() =>
      resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
    ),
    merge: (persisted, current) => ({
      ...current,
      enabled: (persisted as { enabled?: unknown } | null)?.enabled !== false,
    }),
    partialize: ({ enabled }) => ({ enabled }),
  }),
);
