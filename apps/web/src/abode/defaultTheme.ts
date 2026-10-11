import type { ThemePreferenceMode } from "../themePalette";
import { ABODE_THEME_ID } from "./abodeTheme";

/** The theme a profile wears until the user picks one in Settings > Appearance. */
export const ABODE_DEFAULT_THEME = ABODE_THEME_ID;

/**
 * Appearance used when no appearance mode was ever stored. A fresh profile
 * (default theme) follows the system; an existing choice keeps upstream's
 * fallback.
 */
export function defaultAppearanceMode(
  theme: string,
  upstreamFallback: ThemePreferenceMode,
): ThemePreferenceMode {
  return theme === ABODE_DEFAULT_THEME ? "system" : upstreamFallback;
}
