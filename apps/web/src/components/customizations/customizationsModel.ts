import type { CustomizationItem, CustomizationKind, CustomizationScope } from "@t3tools/contracts";

/** Display order and copy for the sidebar's customization groups. */
const GROUP_DEFINITIONS: ReadonlyArray<{
  readonly kind: CustomizationKind;
  readonly label: string;
  readonly emptyLabel: string;
}> = [
  { kind: "skill", label: "Skills", emptyLabel: "No skills yet" },
  { kind: "agent", label: "Agent types", emptyLabel: "No agent types yet" },
  { kind: "mcp", label: "MCP servers", emptyLabel: "No MCP servers yet" },
  { kind: "instructions", label: "Instructions", emptyLabel: "No instructions yet" },
];

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

const HOME_CLAUDE_SEGMENT = /\/\.(?:claude(?:\.json|\/)|codex\/)/;
const WORKSPACE_ROOT_FILES = new Set(["CLAUDE.md", "CLAUDE.local.md", ".mcp.json", "AGENTS.md"]);

function normalizeRoot(cwd: string): string {
  return cwd.replaceAll("\\", "/").replace(/\/+$/, "");
}

/**
 * Whether a path opens in the customizations editor even when the list has not
 * been loaded this session (a restored side panel tab). Workspace files are only
 * the project root's `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json` and `.claude/`
 * (never `.claude/worktrees/`), `AGENTS.md`; outside the project, only `~/.claude*` and `~/.codex/` paths.
 * `panelCwd` is the thread's own cwd: a worktree's files belong to the normal
 * file panel. The server enforces its own allowlist regardless.
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

export type NewCustomizationKind = Extract<CustomizationKind, "skill" | "agent">;

const NEW_ITEM_LAYOUT: Record<
  NewCustomizationKind,
  { readonly base: string; readonly file: (name: string) => string }
> = {
  skill: { base: "new-skill", file: (name) => `.claude/skills/${name}/SKILL.md` },
  agent: { base: "new-agent", file: (name) => `.claude/agents/${name}.md` },
};

/** The `{name, path}` a "create your first skill/agent" action writes, never an existing file. */
export function nextNewCustomization(
  kind: NewCustomizationKind,
  cwd: string,
  existingPaths: ReadonlyArray<string>,
): { readonly name: string; readonly path: string } {
  const root = normalizeRoot(cwd);
  const taken = new Set(existingPaths.map((path) => path.replaceAll("\\", "/")));
  const layout = NEW_ITEM_LAYOUT[kind];
  for (let suffix = 1; ; suffix += 1) {
    const name = suffix === 1 ? layout.base : `${layout.base}-${suffix}`;
    const path = `${root}/${layout.file(name)}`;
    if (!taken.has(path)) return { name, path };
  }
}

export function newCustomizationTemplate(kind: NewCustomizationKind, name: string): string {
  return kind === "skill"
    ? `---\nname: ${name}\ndescription: Describe when Claude should use this skill.\n---\n\nInstructions for Claude go here.\n`
    : `---\nname: ${name}\ndescription: Describe when Claude should delegate to this agent.\n---\n\nYou are a specialist. Describe how this agent should work.\n`;
}
