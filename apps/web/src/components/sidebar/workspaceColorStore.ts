import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import {
  EMPTY_WORKSPACE_COLOR_ASSIGNMENTS,
  ensureAssigned,
  parseWorkspaceColorMenuId,
  resetOverride,
  resolveWorkspaceColorIndex,
  setOverride,
  type WorkspaceColorAssignments,
} from "./workspaceColor";

export const WORKSPACE_COLOR_STORAGE_KEY = "abode:workspace-colors:v1";

interface WorkspaceColorStoreState extends WorkspaceColorAssignments {
  ensureAssigned: (keys: ReadonlyArray<string>) => void;
  setColor: (key: string, index: number) => void;
  resetColor: (key: string) => void;
}

/** Per-user, client-only; never sent to the server. */
export const useWorkspaceColorStore = create<WorkspaceColorStoreState>()(
  persist(
    (set) => ({
      ...EMPTY_WORKSPACE_COLOR_ASSIGNMENTS,
      ensureAssigned: (keys) => set((state) => ensureAssigned(state, keys)),
      setColor: (key, index) => set((state) => setOverride(state, key, index)),
      resetColor: (key) => set((state) => resetOverride(state, key)),
    }),
    {
      name: WORKSPACE_COLOR_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ assigned: state.assigned, overrides: state.overrides }),
    },
  ),
);

/** Apply a clicked "Workspace color" menu id. Returns true when it was one. */
export function applyWorkspaceColorMenuChoice(projectKey: string, menuId: string): boolean {
  const choice = parseWorkspaceColorMenuId(menuId);
  if (choice === null) return false;
  const state = useWorkspaceColorStore.getState();
  if (choice === "reset") state.resetColor(projectKey);
  else state.setColor(projectKey, choice);
  return true;
}

/** Color slot index for a project key; re-renders only when that slot changes. */
export function useWorkspaceColorIndex(projectKey: string | null | undefined): number | null {
  const index = useWorkspaceColorStore((state) =>
    projectKey ? resolveWorkspaceColorIndex(state, projectKey) : null,
  );
  useEffect(() => {
    if (projectKey) useWorkspaceColorStore.getState().ensureAssigned([projectKey]);
  }, [projectKey]);
  return index;
}

/** Assign colors to every listed project in list order (first-seen order). */
export function useEnsureWorkspaceColors(projectKeys: ReadonlyArray<string>): void {
  const signature = projectKeys.join("\u0000");
  useEffect(() => {
    useWorkspaceColorStore.getState().ensureAssigned(projectKeys);
    // The signature stands in for the list identity.
  }, [signature]);
}
