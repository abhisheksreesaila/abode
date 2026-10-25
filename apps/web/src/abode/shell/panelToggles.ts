import type {
  KeybindingCommand,
  KeybindingShortcut,
  ResolvedKeybindingsConfig,
} from "@t3tools/contracts";

import { effectiveShortcutsForCommand } from "../../keybindings";
import { isMacPlatform } from "../../lib/utils";

/**
 * VS Code's three panel toggles. Upstream binds all three and each owner handles its own
 * command, so abode keeps no second state: the palette and sidebar header press the user's
 * own binding, running the keyboard's code path and following rebinding.
 */
export type PanelToggleId = "sidebar" | "terminal" | "rightPanel";

export interface PanelToggle {
  readonly id: PanelToggleId;
  readonly command: KeybindingCommand;
  readonly title: string;
  readonly searchTerms: ReadonlyArray<string>;
}

export const PANEL_TOGGLES: ReadonlyArray<PanelToggle> = [
  {
    id: "sidebar",
    command: "sidebar.toggle",
    title: "Toggle sidebar",
    searchTerms: ["sidebar", "workspaces", "agents", "left panel", "hide", "show"],
  },
  {
    id: "terminal",
    command: "terminal.toggle",
    title: "Toggle terminal",
    searchTerms: ["terminal", "bottom panel", "drawer", "hide", "show"],
  },
  {
    id: "rightPanel",
    command: "rightPanel.toggle",
    title: "Toggle side panel",
    searchTerms: ["side panel", "right panel", "files", "diff", "browser", "hide", "show"],
  },
];

/** The terminal and side panel belong to the thread view; the sidebar works everywhere. */
export function panelTogglesForRoute(input: {
  readonly hasThreadView: boolean;
}): ReadonlyArray<PanelToggle> {
  return input.hasThreadView ? PANEL_TOGGLES : PANEL_TOGGLES.filter((t) => t.id === "sidebar");
}

const NAMED_KEYS: Readonly<Record<string, { key: string; code: string }>> = {
  space: { key: " ", code: "Space" },
  enter: { key: "Enter", code: "Enter" },
  escape: { key: "Escape", code: "Escape" },
  tab: { key: "Tab", code: "Tab" },
};

export function keyboardEventInitForShortcut(
  shortcut: KeybindingShortcut,
  platform: string,
): KeyboardEventInit {
  const useMetaForMod = isMacPlatform(platform);
  const named = NAMED_KEYS[shortcut.key];
  const letter = /^[a-z]$/.test(shortcut.key) ? shortcut.key : null;
  return {
    key: named?.key ?? shortcut.key,
    code: named?.code ?? (letter ? `Key${letter.toUpperCase()}` : ""),
    metaKey: shortcut.metaKey || (shortcut.modKey && useMetaForMod),
    ctrlKey: shortcut.ctrlKey || (shortcut.modKey && !useMetaForMod),
    shiftKey: shortcut.shiftKey,
    altKey: shortcut.altKey,
    bubbles: true,
    cancelable: true,
  };
}

interface RunPanelToggleDeps {
  readonly keybindings: ResolvedKeybindingsConfig;
  readonly platform: string;
  readonly press: (init: KeyboardEventInit) => void;
}

/** Returns false when the user has unbound the command, so nothing can be pressed. */
export function runPanelToggle(id: PanelToggleId, deps: RunPanelToggleDeps): boolean {
  const toggle = PANEL_TOGGLES.find((candidate) => candidate.id === id);
  if (!toggle) return false;
  const [shortcut] = effectiveShortcutsForCommand(deps.keybindings, toggle.command, {
    platform: deps.platform,
  });
  if (!shortcut) return false;
  deps.press(keyboardEventInitForShortcut(shortcut, deps.platform));
  return true;
}

/** Dispatched on the body so handlers see an element target, as with a real key press. */
export function pressOnBody(init: KeyboardEventInit): void {
  document.body.dispatchEvent(new KeyboardEvent("keydown", init));
}
