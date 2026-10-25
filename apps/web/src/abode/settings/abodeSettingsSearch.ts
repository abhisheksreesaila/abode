import type { SettingsSearchItem } from "../../components/settings/settingsSearch";

/**
 * Settings search entries for abode's General sections (`AbodeSettingsSections`).
 * Each `id` is the `id` of the `SettingsSection` it opens, which scrolls to it and
 * pulses it. Upstream's index spreads this list in.
 */
export const ABODE_SETTINGS_SEARCH_ITEMS = [
  {
    id: "voice",
    title: "Voice dictation",
    to: "/settings/general",
    searchTerms: [
      "speech microphone mic talk hold-to-talk key push to talk engine host model moonshine nemotron transcribe composer",
    ],
  },
  {
    id: "abode-chat",
    title: "abode chat",
    to: "/settings/general",
    searchTerms: [
      "cards helpers characters avatars boss face brows calm eyes scarf names photo classic chat",
    ],
  },
] as const satisfies ReadonlyArray<SettingsSearchItem>;
