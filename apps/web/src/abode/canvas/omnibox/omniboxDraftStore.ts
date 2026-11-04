import { create } from "zustand";

interface OmniboxDraftStore {
  /** Text another screen wants in the omnibox; the bar takes it and clears it. */
  readonly draft: string | null;
  setDraft: (draft: string | null) => void;
}

export const useOmniboxDraftStore = create<OmniboxDraftStore>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));
