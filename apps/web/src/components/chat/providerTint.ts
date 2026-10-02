/**
 * Provider identity for the harness/model picker trigger: a neutral chip with a
 * small brand dot (Claude orange #d97757, Codex green); every other provider
 * stays plain. The dot classes live in chipTint.ts, which ComposerControl reads
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
