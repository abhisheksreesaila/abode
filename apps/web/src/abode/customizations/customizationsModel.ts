import type { CustomizationItem, CustomizationKind, CustomizationScope } from "@t3tools/contracts";

/** Display order and copy for the sidebar's customization groups. */
const GROUP_DEFINITIONS: ReadonlyArray<{
  readonly kind: CustomizationKind;
  readonly label: string;
  readonly emptyLabel: string;
}> = [
  { kind: "skill", label: "Skills", emptyLabel: "No skills yet" },
  { kind: "agent", label: "Agents", emptyLabel: "No agents yet" },
  { kind: "mcp", label: "MCP servers", emptyLabel: "No MCP servers yet" },
  { kind: "instructions", label: "Instructions", emptyLabel: "No instructions yet" },
];

export type CustomizationPageId = "pull-requests" | "usage";

/** Pages listed after the customization groups. Pull requests only where an environment supports them. */
export function customizationPageRows(input: {
  readonly pullRequestsSupported: boolean;
}): ReadonlyArray<{ readonly id: CustomizationPageId; readonly label: string }> {
  return [
    ...(input.pullRequestsSupported
      ? [{ id: "pull-requests" as const, label: "Pull requests" }]
      : []),
    { id: "usage" as const, label: "Usage" },
  ];
}

export interface CustomizationGroup {
  readonly kind: CustomizationKind;
  readonly label: string;
  readonly emptyLabel: string;
  readonly count: number;
  readonly items: ReadonlyArray<CustomizationItem>;
}

const SCOPE_ORDER: Record<CustomizationScope, number> = { workspace: 0, user: 1 };

/** Always returns all four groups, so an empty group still renders its empty state. */
export function groupCustomizations(
  items: ReadonlyArray<CustomizationItem>,
): ReadonlyArray<CustomizationGroup> {
  return GROUP_DEFINITIONS.map((definition) => {
    const groupItems = items
      .filter((item) => item.kind === definition.kind)
      .toSorted(
        (a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] || a.name.localeCompare(b.name),
      );
    return { ...definition, count: groupItems.length, items: groupItems };
  });
}

/** User-scope files are shared across every workspace, so they open locked. */
export function defaultLocked(input: {
  readonly scope: CustomizationScope;
  readonly readOnly: boolean;
}): boolean {
  return input.readOnly || input.scope === "user";
}

/** A read-only file (the global `.claude.json`) can never be unlocked. */
export function canUnlock(input: { readonly readOnly: boolean }): boolean {
  return !input.readOnly;
}

/** `choice` is the user's explicit toggle for this file, if they made one. */
export function resolveLocked(input: {
  readonly scope: CustomizationScope;
  readonly readOnly: boolean;
  readonly choice: boolean | undefined;
}): boolean {
  if (!canUnlock(input)) return true;
  return input.choice ?? defaultLocked(input);
}

interface CustomizationsErrorShape {
  readonly _tag: "CustomizationsError";
  readonly failure: string;
  readonly message: string;
}

function isCustomizationsError(error: unknown): error is CustomizationsErrorShape {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { _tag?: unknown })._tag === "CustomizationsError" &&
    typeof (error as { failure?: unknown }).failure === "string"
  );
}

/** One plain sentence per failure; never includes file contents. */
export function describeCustomizationsError(error: unknown): string {
  if (isCustomizationsError(error)) {
    switch (error.failure) {
      case "cwd_not_registered":
        return "This workspace is not registered, so its customizations can't be read.";
      case "path_not_allowed":
        return "This file is outside the places Claude customizations live.";
      case "read_only":
        return "This file is read-only and can't be saved.";
      case "already_exists":
        return "A file with that name already exists. Pick another name.";
      case "file_too_large":
        return "This file is too large to open here.";
      default:
        return "Couldn't read or write the file. Try again.";
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** The write failed because the file is already there (a create never overwrites). */
export function isAlreadyExistsError(error: unknown): boolean {
  return isCustomizationsError(error) && error.failure === "already_exists";
}

const HOME_CLAUDE_SEGMENT = /\/\.(?:claude(?:\.json|\/)|codex\/)/;
const WORKSPACE_ROOT_FILES = new Set(["CLAUDE.md", "CLAUDE.local.md", ".mcp.json", "AGENTS.md"]);

function normalizeRoot(cwd: string): string {
  return cwd.replaceAll("\\", "/").replace(/\/+$/, "");
}

/**
 * Whether a path opens in the customizations editor without the list loaded (a restored tab):
 * the project root's `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json`, `AGENTS.md`, `.claude/` (not
 * `.claude/worktrees/`), plus `~/.claude*` and `~/.codex/`. A worktree `panelCwd`'s files stay
 * with the normal file panel. The server enforces its own allowlist regardless.
 */
export function isCustomizationPath(input: {
  readonly path: string;
  readonly projectRoot: string;
  readonly panelCwd?: string;
}): boolean {
  const path = input.path.replaceAll("\\", "/");
  const root = normalizeRoot(input.projectRoot);
  if (root.length > 0 && path.startsWith(`${root}/`)) {
    const rel = path.slice(root.length + 1);
    if (WORKSPACE_ROOT_FILES.has(rel)) return true;
    return rel.startsWith(".claude/") && !rel.startsWith(".claude/worktrees/");
  }
  const panelRoot = input.panelCwd === undefined ? "" : normalizeRoot(input.panelCwd);
  if (panelRoot.length > 0 && path.startsWith(`${panelRoot}/`)) return false;
  return HOME_CLAUDE_SEGMENT.test(path);
}

/** Workspace files show relative to the workspace; user files show as `~/.claude/...` or `~/.codex/...`. */
export function displayCustomizationPath(path: string, cwd: string): string {
  const normalized = path.replaceAll("\\", "/");
  const root = normalizeRoot(cwd);
  if (root.length > 0 && normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  const match = HOME_CLAUDE_SEGMENT.exec(normalized);
  return match ? `~${normalized.slice(match.index)}` : normalized;
}

export function customizationScopeForPath(path: string, cwd: string): CustomizationScope {
  const normalized = path.replaceAll("\\", "/");
  const root = normalizeRoot(cwd);
  return root.length > 0 && normalized.startsWith(`${root}/`) ? "workspace" : "user";
}

/**
 * Items the sidebar list has seen, by absolute path, so the editor can tell a
 * user file from a workspace one. Holds names and paths only, never contents.
 */
const knownItems = new Map<string, CustomizationItem>();

export function rememberCustomizations(items: ReadonlyArray<CustomizationItem>): void {
  for (const item of items) knownItems.set(item.path, item);
}

export function findKnownCustomization(path: string): CustomizationItem | undefined {
  return knownItems.get(path);
}

/** The providers whose skills Customizations edits. */
const SKILL_DRIVERS: ReadonlySet<string> = new Set(["claudeAgent", "codex"]);

/**
 * Which provider instances rescan skills after a skill file changes: the thread's own provider,
 * or on a new-thread draft (no provider chosen yet) every enabled, installed Claude and Codex one.
 */
export function skillRefreshInstanceIds<Id extends string>(
  threadInstanceId: Id | undefined,
  providers: ReadonlyArray<{
    readonly instanceId: Id;
    readonly driver: string;
    readonly enabled: boolean;
    readonly installed: boolean;
  }>,
): ReadonlyArray<Id> {
  if (threadInstanceId) return [threadInstanceId];
  return providers
    .filter(
      (provider) => SKILL_DRIVERS.has(provider.driver) && provider.enabled && provider.installed,
    )
    .map((provider) => provider.instanceId);
}
