import { parseKeybindingShortcut } from "@t3tools/shared/keybindings";

import { formatShortcutLabel, shortcutKeyFromEvent, type ShortcutEventLike } from "../keybindings";
import { isMacPlatform } from "../lib/utils";

/**
 * Hold-to-talk key. Not in the built-in keybinding defaults
 * (`packages/shared/src/keybindings.ts`), so it never shadows an existing command.
 * Stored client-side because keybinding commands are a closed set in the contracts.
 */
export const DEFAULT_VOICE_SHORTCUT = "ctrl+shift+space";

type ShortcutEvent = Pick<
  ShortcutEventLike,
  "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

export function matchesVoiceShortcut(
  event: ShortcutEvent,
  shortcutValue: string,
  platform = navigator.platform,
): boolean {
  const shortcut = parseKeybindingShortcut(shortcutValue);
  if (!shortcut) return false;
  const mac = isMacPlatform(platform);
  const meta = shortcut.metaKey || (shortcut.modKey && mac);
  const ctrl = shortcut.ctrlKey || (shortcut.modKey && !mac);
  return (
    event.metaKey === meta &&
    event.ctrlKey === ctrl &&
    event.shiftKey === shortcut.shiftKey &&
    event.altKey === shortcut.altKey &&
    shortcutKeyFromEvent(event) === shortcut.key
  );
}

const MODIFIER_KEYS = {
  Control: "ctrl",
  Shift: "shift",
  Alt: "alt",
  Meta: "meta",
} as const;

/** A keyup ends the hold when it releases the main key or any modifier the shortcut needs. */
export function isShortcutRelease(
  event: ShortcutEvent,
  shortcutValue: string,
  platform = navigator.platform,
): boolean {
  const shortcut = parseKeybindingShortcut(shortcutValue);
  if (!shortcut) return false;
  const modifier = (MODIFIER_KEYS as Record<string, string | undefined>)[event.key];
  if (modifier) {
    const mac = isMacPlatform(platform);
    switch (modifier) {
      case "ctrl":
        return shortcut.ctrlKey || (shortcut.modKey && !mac);
      case "meta":
        return shortcut.metaKey || (shortcut.modKey && mac);
      case "shift":
        return shortcut.shiftKey;
      default:
        return shortcut.altKey;
    }
  }
  return shortcutKeyFromEvent(event) === shortcut.key;
}

export function voiceShortcutLabel(shortcutValue: string, platform = navigator.platform): string {
  const shortcut = parseKeybindingShortcut(shortcutValue);
  return shortcut ? formatShortcutLabel(shortcut, platform) : shortcutValue;
}
