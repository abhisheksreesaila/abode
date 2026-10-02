import { DEFAULT_RESOLVED_KEYBINDINGS, parseKeybindingShortcut } from "@t3tools/shared/keybindings";

import { keybindingFromKeyboardEvent } from "../components/settings/KeybindingsSettings.logic";
import { shortcutConflictKey } from "../keybindings";

type CaptureEvent = Parameters<typeof keybindingFromKeyboardEvent>[0];

export type ShortcutCapture =
  | { kind: "cancel" }
  | { kind: "ignore" }
  | { kind: "shortcut"; value: string };

/**
 * Turns a keydown while recording a new hold-to-talk key into a stored shortcut.
 * A bare key is ignored: a hold-to-talk key without a modifier would swallow typing.
 */
export function captureVoiceShortcut(event: CaptureEvent, platform: string): ShortcutCapture {
  if (event.key === "Escape") return { kind: "cancel" };
  if (!event.metaKey && !event.ctrlKey && !event.altKey) return { kind: "ignore" };
  const value = keybindingFromKeyboardEvent(event, platform);
  return value ? { kind: "shortcut", value } : { kind: "ignore" };
}

/** The built-in command that already uses this shortcut, if any. */
export function findVoiceShortcutConflict(
  value: string,
  platform: string,
  bindings: ReadonlyArray<{
    command: string;
    shortcut: NonNullable<ReturnType<typeof parseKeybindingShortcut>>;
  }> = DEFAULT_RESOLVED_KEYBINDINGS,
): string | null {
  const shortcut = parseKeybindingShortcut(value);
  if (!shortcut) return null;
  const key = shortcutConflictKey(shortcut, platform);
  return (
    bindings.find((binding) => shortcutConflictKey(binding.shortcut, platform) === key)?.command ??
    null
  );
}
