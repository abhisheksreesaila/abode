import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";

import type { PanelToggleTarget } from "../panelToggleBus";

// Command palette rows for the three layout panels. `shortcutCommand` makes the
// palette show the live binding (Ctrl/Cmd+B, J, Alt+B by default).
export const PANEL_TOGGLE_PALETTE_ENTRIES = [
  {
    target: "sidebar",
    title: "Toggle sidebar",
    searchTerms: ["sidebar", "threads", "left panel", "hide", "show"],
    shortcutCommand: "sidebar.toggle",
    Icon: PanelLeftIcon,
  },
  {
    target: "terminal",
    title: "Toggle terminal",
    searchTerms: ["terminal", "bottom panel", "drawer", "hide", "show"],
    shortcutCommand: "terminal.toggle",
    Icon: PanelBottomIcon,
  },
  {
    target: "rightPanel",
    title: "Toggle side panel",
    searchTerms: ["side panel", "right panel", "agents", "preview", "files", "hide", "show"],
    shortcutCommand: "rightPanel.toggle",
    Icon: PanelRightIcon,
  },
] as const satisfies ReadonlyArray<{
  target: PanelToggleTarget;
  title: string;
  searchTerms: readonly string[];
  shortcutCommand: string;
  Icon: unknown;
}>;
