import { create } from "zustand";

interface KitStore {
  readonly open: boolean;
  setOpen: (open: boolean) => void;
}

export const useKitStore = create<KitStore>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
