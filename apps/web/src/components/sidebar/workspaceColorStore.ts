import { useLayoutEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import {
  EMPTY_WORKSPACE_COLOR_ASSIGNMENTS,
  ensureAssigned,
  syncAssigned,
  parseWorkspaceColorMenuId,
  resetOverride,
  sanitizePersistedAssignments,
  resolveWorkspaceColorIndex,
  setOverride,
  type WorkspaceColorAssignments,
} from "./workspaceColor";

export const WORKSPACE_COLOR_STORAGE_KEY = "abode:workspace-colors:v1";

interface WorkspaceColorStoreState extends WorkspaceColorAssignments {
  ensureAssigned: (keys: ReadonlyArray<string>) => void;
  syncProjects: (liveKeys: ReadonlyArray<string>) => void;
  setColor: (key: string, index: number) => void;
  resetColor: (key: string) => void;
}

/** Per-user, client-only; never sent to the server. */
export const useWorkspaceColorStore = create<WorkspaceColorStoreState>()(
  persist(
    (set) => ({
      ...EMPTY_WORKSPACE_COLOR_ASSIGNMENTS,
      ensureAssigned: (keys) => set((state) => ensureAssigned(state, keys)),
      syncProjects: (liveKeys) => set((state) => syncAssigned(state, liveKeys)),
      setColor: (key, index) => set((state) => setOverride(state, key, index)),
      resetColor: (key) => set((state) => resetOverride(state, key)),
    }),
    {
      name: WORKSPACE_COLOR_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizePersistedAssignments(persisted),
      }),
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
  return useWorkspaceColorStore((state) =>
    projectKey ? resolveWorkspaceColorIndex(state, projectKey) : null,
  );
}

/**
 * Called once by the sidebar with its project keys in project order. Runs in a
 * layout effect so assignments land before the first paint; rows read colors
 * through a per-key selector and never assign themselves.
 */
export function useEnsureWorkspaceColors(projectKeys: ReadonlyArray<string>): void {
  const signature = projectKeys.join("\u0000");
  useLayoutEffect(() => {
    useWorkspaceColorStore.getState().syncProjects(projectKeys);
    // The signature stands in for the list identity.
  }, [signature]);
}
