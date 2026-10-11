import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon } from "lucide-react";

import { isCommandPaletteOpen } from "~/commandPaletteBus";
import { ITEM_ICON_CLASS, type CommandPaletteActionItem } from "~/components/CommandPalette.logic";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { primaryServerKeybindingsAtom } from "~/state/server";
import {
  panelTogglesForRoute,
  pressOnBody,
  runPanelToggle,
  type PanelToggleId,
} from "./panelToggles";

const ICONS: Record<PanelToggleId, typeof PanelLeftIcon> = {
  sidebar: PanelLeftIcon,
  terminal: PanelBottomIcon,
  rightPanel: PanelRightIcon,
};

/** Key handlers ignore the keyboard while the palette is open, so wait for it to finish closing. */
function afterPaletteCloses(action: () => void, framesLeft = 60): void {
  if (!isCommandPaletteOpen() || framesLeft === 0) {
    action();
    return;
  }
  requestAnimationFrame(() => afterPaletteCloses(action, framesLeft - 1));
}

/**
 * Command palette rows for the three panel toggles. Each row presses the
 * command's own shortcut, so it runs the exact code the keyboard does and the
 * palette shows the live binding next to it.
 */
export function abodePanelToggleActions(input: {
  readonly hasThreadView: boolean;
}): CommandPaletteActionItem[] {
  return panelTogglesForRoute(input).map((toggle): CommandPaletteActionItem => {
    const Icon = ICONS[toggle.id];
    return {
      kind: "action",
      value: `action:abode-toggle-${toggle.id}`,
      searchTerms: toggle.searchTerms,
      title: toggle.title,
      icon: <Icon className={ITEM_ICON_CLASS} />,
      shortcutCommand: toggle.command,
      run: async () => {
        afterPaletteCloses(() => {
          runPanelToggle(toggle.id, {
            keybindings: appAtomRegistry.get(primaryServerKeybindingsAtom),
            platform: navigator.platform,
            press: pressOnBody,
          });
        });
      },
    };
  });
}
