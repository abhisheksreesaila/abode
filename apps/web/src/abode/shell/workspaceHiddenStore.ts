import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import { sanitizePersistedHiddenKeys, setWorkspaceHidden } from "./workspaceHidden";

export const HIDDEN_WORKSPACES_STORAGE_KEY = "abode:hidden-workspaces:v1";

interface HiddenWorkspacesState {
  readonly hiddenKeys: ReadonlyArray<string>;
  setHidden: (projectKey: string, hidden: boolean) => void;
}

/** Per-user, client-only; never sent to the server. */
export const useHiddenWorkspacesStore = create<HiddenWorkspacesState>()(
  persist(
    (set) => ({
      hiddenKeys: [],
      setHidden: (projectKey, hidden) =>
        set((state) => ({ hiddenKeys: setWorkspaceHidden(state.hiddenKeys, projectKey, hidden) })),
    }),
    {
      name: HIDDEN_WORKSPACES_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({
        ...current,
        hiddenKeys: sanitizePersistedHiddenKeys(persisted),
      }),
      partialize: (state) => ({ hiddenKeys: state.hiddenKeys }),
    },
  ),
);
