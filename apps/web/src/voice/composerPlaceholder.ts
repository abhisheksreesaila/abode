import { voiceShortcutLabel } from "./shortcut";

/**
 * The Fluent composer's default placeholder (F-029). It names the real
 * hold-to-talk key from voice settings, and says nothing about talking when
 * voice is off. Null means keep the composer's own placeholder.
 */
export function fluentReplyPlaceholder(
  voice: { enabled: boolean; shortcut: string },
  themeId: string | undefined,
): string | null {
  if (themeId !== "abode") return null;
  return voice.enabled
    ? `Reply, or hold ${voiceShortcutLabel(voice.shortcut)} to talk`
    : "Reply to the agent";
}
