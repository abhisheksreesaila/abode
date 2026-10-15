import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import { sanitizePersistedRemovedKeys, setWorkspaceRemoved } from "./workspaceRemoved";

/** Unchanged from when this list was "hidden", so existing entries carry over. */
export const REMOVED_WORKSPACES_STORAGE_KEY = "abode:hidden-workspaces:v1";

interface RemovedWorkspacesState {
  readonly removedKeys: ReadonlyArray<string>;
  setRemoved: (projectKey: string, removed: boolean) => void;
}

/** Per-user, client-only; never sent to the server. */
export const useRemovedWorkspacesStore = create<RemovedWorkspacesState>()(
  persist(
    (set) => ({
      removedKeys: [],
      setRemoved: (projectKey, removed) =>
        set((state) => ({
          removedKeys: setWorkspaceRemoved(state.removedKeys, projectKey, removed),
        })),
    }),
    {
      name: REMOVED_WORKSPACES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({
        ...current,
        removedKeys: sanitizePersistedRemovedKeys(persisted),
      }),
      partialize: (state) => ({ removedKeys: state.removedKeys }),
    },
  ),
);
