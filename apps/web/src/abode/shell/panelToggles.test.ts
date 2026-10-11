import type { KeybindingShortcut, ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  PANEL_TOGGLES,
  keyboardEventInitForShortcut,
  runPanelToggle,
  type PanelToggleId,
} from "./panelToggles";

const shortcut = (
  overrides: Partial<KeybindingShortcut> & { key: string },
): KeybindingShortcut => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  modKey: false,
  ...overrides,
});

describe("keyboardEventInitForShortcut", () => {
  it("turns mod into ctrl off macOS and meta on macOS", () => {
    const modB = shortcut({ key: "b", modKey: true });
    expect(keyboardEventInitForShortcut(modB, "Linux x86_64")).toMatchObject({
      key: "b",
      code: "KeyB",
      ctrlKey: true,
      metaKey: false,
    });
    expect(keyboardEventInitForShortcut(modB, "MacIntel")).toMatchObject({
      ctrlKey: false,
      metaKey: true,
    });
  });

  it("keeps explicit modifiers and Alt", () => {
    const init = keyboardEventInitForShortcut(
      shortcut({ key: "b", modKey: true, altKey: true }),
      "Linux x86_64",
    );
    expect(init).toMatchObject({ key: "b", ctrlKey: true, altKey: true, shiftKey: false });
  });

  it("is a real keydown that bubbles and can be cancelled", () => {
    expect(
      keyboardEventInitForShortcut(shortcut({ key: "j", modKey: true }), "Linux"),
    ).toMatchObject({ bubbles: true, cancelable: true });
  });
});

describe("PANEL_TOGGLES", () => {
  it("covers the three VS Code panels with upstream's own commands", () => {
    expect(PANEL_TOGGLES.map((toggle) => [toggle.id, toggle.command])).toEqual([
      ["sidebar", "sidebar.toggle"],
      ["terminal", "terminal.toggle"],
      ["rightPanel", "rightPanel.toggle"],
    ]);
  });
});

describe("runPanelToggle", () => {
  const keybindings = [
    { command: "sidebar.toggle", shortcut: shortcut({ key: "b", modKey: true }) },
    { command: "terminal.toggle", shortcut: shortcut({ key: "j", modKey: true }) },
    {
      command: "rightPanel.toggle",
      shortcut: shortcut({ key: "b", modKey: true, altKey: true }),
    },
  ] as unknown as ResolvedKeybindingsConfig;

  it.each<[PanelToggleId, Partial<KeyboardEventInit>]>([
    ["sidebar", { key: "b", ctrlKey: true, altKey: false }],
    ["terminal", { key: "j", ctrlKey: true, altKey: false }],
    ["rightPanel", { key: "b", ctrlKey: true, altKey: true }],
  ])("presses the bound shortcut for %s", (id, expected) => {
    const press = vi.fn();
    expect(runPanelToggle(id, { keybindings, platform: "Linux", press })).toBe(true);
    expect(press).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  it("follows a rebinding instead of assuming Ctrl+B", () => {
    const rebound = [
      { command: "sidebar.toggle", shortcut: shortcut({ key: "e", modKey: true, shiftKey: true }) },
    ] as unknown as ResolvedKeybindingsConfig;
    const press = vi.fn();
    runPanelToggle("sidebar", { keybindings: rebound, platform: "Linux", press });
    expect(press).toHaveBeenCalledWith(
      expect.objectContaining({ key: "e", ctrlKey: true, shiftKey: true }),
    );
  });

  it("does nothing, and says so, when the command was unbound", () => {
    const press = vi.fn();
    expect(
      runPanelToggle("terminal", {
        keybindings: [] as unknown as ResolvedKeybindingsConfig,
        platform: "Linux",
        press,
      }),
    ).toBe(false);
    expect(press).not.toHaveBeenCalled();
  });
});
