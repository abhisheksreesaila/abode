import { create } from "zustand";

interface DrawerStore {
  /** The session whose chat drawer is open (a pill's key), or null. */
  readonly sessionKey: string | null;
  open: (sessionKey: string | null) => void;
  close: () => void;
}

/** Shared so a pill, the overview feed and the omnibox (after a send) open the same drawer. */
export const useDrawerStore = create<DrawerStore>()((set) => ({
  sessionKey: null,
  open: (sessionKey) => set({ sessionKey }),
  close: () => set({ sessionKey: null }),
}));
