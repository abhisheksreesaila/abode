import { create } from "zustand";

import type { CustomizationEditorTarget } from "./components/customizations/CustomizationEditor";
import type { CustomizationsScope } from "./components/customizations/CustomizationsSection";

/**
 * The one open customization editor (abode F-045). The scope (environment, workspace root) is
 * captured here when the editor opens, so route or thread changes behind it can never retarget,
 * overwrite or unmount an edit in progress. Opened from the sidebar and from the side-panel router.
 */
export interface OpenCustomizationEditor {
  readonly scope: CustomizationsScope;
  readonly target: CustomizationEditorTarget;
}

interface CustomizationEditorState {
  readonly open: OpenCustomizationEditor | null;
  readonly openEditor: (request: OpenCustomizationEditor) => void;
  readonly closeEditor: () => void;
}

export const useCustomizationEditorStore = create<CustomizationEditorState>((set) => ({
  open: null,
  openEditor: (request) => set({ open: request }),
  closeEditor: () => set({ open: null }),
}));
