// @vitest-environment jsdom

import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { describe, expect, it } from "vite-plus/test";

import { resolveShortcutCommand } from "../../keybindings";
import { PANEL_TOGGLES, runPanelToggle } from "./panelToggles";

describe("panel toggles round trip", () => {
  it.each(["Linux x86_64", "MacIntel"])(
    "the key press runPanelToggle builds resolves back to the same command on %s",
    (platform) => {
      for (const toggle of PANEL_TOGGLES) {
        let resolved: string | null = null;
        const pressed = runPanelToggle(toggle.id, {
          keybindings: DEFAULT_RESOLVED_KEYBINDINGS,
          platform,
          press: (init) => {
            const event = new KeyboardEvent("keydown", init);
            resolved = resolveShortcutCommand(event, DEFAULT_RESOLVED_KEYBINDINGS, { platform });
          },
        });
        expect(pressed).toBe(true);
        expect(resolved).toBe(toggle.command);
      }
    },
  );
});
