import * as Schema from "effect/Schema";

import { useLocalStorage } from "../hooks/useLocalStorage";
import { DEFAULT_VOICE_SHORTCUT } from "./shortcut";

/**
 * Voice dictation preferences. Client-side only (this browser or desktop profile): the
 * server's keybinding commands are a closed set in `packages/contracts`, so the
 * hold-to-talk key lives here rather than in keybindings.json.
 */
export const VoiceSettingsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  shortcut: Schema.String,
});
export type VoiceSettings = typeof VoiceSettingsSchema.Type;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  shortcut: DEFAULT_VOICE_SHORTCUT,
};

export const VOICE_SETTINGS_STORAGE_KEY = "abode:voice-settings:v1";

export function useVoiceSettings() {
  const [settings, setSettings] = useLocalStorage(
    VOICE_SETTINGS_STORAGE_KEY,
    DEFAULT_VOICE_SETTINGS,
    VoiceSettingsSchema,
  );
  const update = (patch: Partial<VoiceSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));
  return { settings, update };
}
