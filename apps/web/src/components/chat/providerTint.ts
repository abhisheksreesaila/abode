/**
 * Faint provider tint for the harness/model picker trigger. Claude is orange
 * (#d97757 at about 12% background, warmer border and text); Codex a muted
 * green; every other provider stays neutral. ComposerControl takes the result
 * as its `tint` variant.
 */
export type ProviderTint = "none" | "claude" | "codex";

const PROVIDER_TINT_BY_DRIVER: Readonly<Record<string, ProviderTint>> = {
  claudeAgent: "claude",
  codex: "codex",
};

export function resolveProviderTint(driverKind: string | null | undefined): ProviderTint {
  return (driverKind ? PROVIDER_TINT_BY_DRIVER[driverKind] : undefined) ?? "none";
}

/**
 * Class strings are written out in full so Tailwind sees them. Text mixes the
 * brand hue into the foreground so it stays readable in light and dark themes.
 */
export const PROVIDER_TINT_CLASS_NAMES: Readonly<Record<ProviderTint, string>> = {
  none: "",
  claude:
    "border-[#d97757]/45 bg-[#d97757]/12 text-[color-mix(in_srgb,#d97757_70%,var(--foreground))] hover:bg-[#d97757]/18 hover:text-[color-mix(in_srgb,#d97757_80%,var(--foreground))]",
  codex:
    "border-[#10a37f]/40 bg-[#10a37f]/12 text-[color-mix(in_srgb,#10a37f_65%,var(--foreground))] hover:bg-[#10a37f]/18 hover:text-[color-mix(in_srgb,#10a37f_75%,var(--foreground))]",
};
