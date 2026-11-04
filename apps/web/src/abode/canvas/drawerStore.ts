import { create } from "zustand";

interface DrawerStore {
  /** The session whose chat drawer is open (a pill's key), or null. */
  readonly sessionKey: string | null;
  /** A workspace's "New session" draft: no thread exists until the first message is sent. */
  readonly draftWorkspaceKey: string | null;
  open: (sessionKey: string | null) => void;
  openDraft: (workspaceKey: string) => void;
  close: () => void;
}

/** Shared so a pill, the overview feed and the omnibox (after a send) open the same drawer. */
export const useDrawerStore = create<DrawerStore>()((set) => ({
  sessionKey: null,
  draftWorkspaceKey: null,
  open: (sessionKey) => set({ sessionKey, draftWorkspaceKey: null }),
  openDraft: (workspaceKey) => set({ sessionKey: null, draftWorkspaceKey: workspaceKey }),
  close: () => set({ sessionKey: null, draftWorkspaceKey: null }),
}));
