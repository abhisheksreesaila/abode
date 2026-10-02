import type { RuntimeMode } from "@t3tools/contracts";

import type { ProviderTint } from "./providerTint";

/**
 * Semantic tints for composer controls (F-027). Risk reads at a glance:
 * red is reserved for Full access, amber for edits that land unreviewed,
 * green for "asks first". Branch and workspace tints say where you are.
 * ComposerControl takes any of these as its `tint` variant.
 */
export type SemanticChipTint =
  | "danger"
  | "caution"
  | "safe"
  | "branch-main"
  | "branch-feature"
  | "worktree";

export type ChipTint = ProviderTint | SemanticChipTint;

export function resolveRuntimeModeTint(mode: RuntimeMode): ChipTint {
  switch (mode) {
    case "full-access":
      return "danger";
    case "auto-accept-edits":
      return "caution";
    case "approval-required":
      return "safe";
    default:
      return "none";
  }
}

const MAIN_BRANCH_NAMES: ReadonlySet<string> = new Set(["main", "master", "trunk"]);

/** Purple for the trunk branch, blue for anything else, none when there is no branch. */
export function resolveBranchTint(branch: string | null | undefined): ChipTint {
  const name = branch?.trim();
  if (!name) return "none";
  return MAIN_BRANCH_NAMES.has(name.toLowerCase()) ? "branch-main" : "branch-feature";
}

export function resolveWorkspaceTint(isWorktree: boolean): ChipTint {
  return isWorktree ? "worktree" : "none";
}

/**
 * One class string per color, built from the --chip-<name> and --chip-<name>-fg
 * theme variables (index.css), so a theme can retune a hue without touching
 * components. Class names are written out in full so Tailwind sees them.
 */
const DOT =
  "before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] before:bg-(--chip-dot)";

export const CHIP_TINT_CLASS_NAMES: Readonly<Record<ChipTint, string>> = {
  none: "",
  // Provider chips stay neutral and carry a small brand dot before the label.
  claude: `[--chip-dot:var(--chip-claude)] ${DOT}`,
  codex: `[--chip-dot:var(--chip-codex)] ${DOT}`,
  danger:
    "font-semibold border-[color-mix(in_srgb,var(--chip-danger)_60%,transparent)] bg-[color-mix(in_srgb,var(--chip-danger)_16%,transparent)] text-(--chip-danger-fg) hover:bg-[color-mix(in_srgb,var(--chip-danger)_24%,transparent)] hover:text-(--chip-danger-fg)",
  caution:
    "border-[color-mix(in_srgb,var(--chip-caution)_45%,transparent)] bg-[color-mix(in_srgb,var(--chip-caution)_14%,transparent)] text-(--chip-caution-fg) hover:bg-[color-mix(in_srgb,var(--chip-caution)_20%,transparent)] hover:text-(--chip-caution-fg)",
  safe: "border-[color-mix(in_srgb,var(--chip-safe)_35%,transparent)] bg-[color-mix(in_srgb,var(--chip-safe)_12%,transparent)] text-(--chip-safe-fg) hover:bg-[color-mix(in_srgb,var(--chip-safe)_18%,transparent)] hover:text-(--chip-safe-fg)",
  "branch-main":
    "border-[color-mix(in_srgb,var(--chip-purple)_40%,transparent)] bg-[color-mix(in_srgb,var(--chip-purple)_13%,transparent)] text-(--chip-purple-fg) hover:bg-[color-mix(in_srgb,var(--chip-purple)_19%,transparent)] hover:text-(--chip-purple-fg)",
  "branch-feature":
    "border-[color-mix(in_srgb,var(--chip-blue)_38%,transparent)] bg-[color-mix(in_srgb,var(--chip-blue)_12%,transparent)] text-(--chip-blue-fg) hover:bg-[color-mix(in_srgb,var(--chip-blue)_18%,transparent)] hover:text-(--chip-blue-fg)",
  worktree:
    "border-[color-mix(in_srgb,var(--chip-teal)_38%,transparent)] bg-[color-mix(in_srgb,var(--chip-teal)_12%,transparent)] text-(--chip-teal-fg) hover:bg-[color-mix(in_srgb,var(--chip-teal)_18%,transparent)] hover:text-(--chip-teal-fg)",
};
