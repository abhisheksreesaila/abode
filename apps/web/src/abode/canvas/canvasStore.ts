import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";

const CANVAS_STORAGE_KEY = "abode:canvas:v1";

interface CanvasStore {
  /** One Window: the canvas replaces the Control room on "/". Off is abode as it was. */
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
