import type {
  CustomizationHarness,
  CustomizationKind,
  CustomizationScope,
} from "@t3tools/contracts";

/**
 * What the "+" dialog on a Customizations folder writes (abode F-043): the file's location per
 * harness and scope, and its starting template. Paths for user scope are `~/.claude/...` or
 * `~/.codex/...`; the server expands them, so the client never needs the home directory.
 */

export interface NewCustomizationRequest {
  readonly kind: CustomizationKind;
  readonly harness: CustomizationHarness;
  readonly scope: CustomizationScope;
  /** Raw name the user typed; skills and agents only. */
  readonly name: string;
  /** Absolute workspace root, for workspace-scope paths. */
  readonly cwd: string;
}

export interface NewCustomizationPlan {
  /** Where the file is written (or opened, when it already exists). */
  readonly path: string;
  /** The template the user can edit before saving; empty for read-only targets. */
  readonly contents: string;
  /** Instructions and MCP files are opened when they already exist; skills and agents are not overwritten. */
  readonly openIfExists: boolean;
  /** The file can be opened but never saved (Codex `config.toml`). */
  readonly readOnly: boolean;
}

/** `My Cool Skill!` becomes `my-cool-skill`: lowercase letters, digits and single dashes. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Whether the folder's "+" asks for a name (skills and agents) or targets a fixed file. */
export function needsName(kind: CustomizationKind): boolean {
  return kind === "skill" || kind === "agent";
}

/**
 * The scopes a folder can create into, per harness. Codex skills and prompts live only in
 * `~/.codex`; Codex instructions are the workspace `AGENTS.md`; Claude MCP servers are declared
 * in the workspace `.mcp.json` (the user-level file is Claude's private state and read-only).
 */
export function availableScopes(
  kind: CustomizationKind,
  harness: CustomizationHarness,
): ReadonlyArray<CustomizationScope> {
  if (harness === "codex") {
    if (kind === "instructions") return ["workspace"];
    return ["user"];
  }
  return kind === "mcp" ? ["workspace"] : ["workspace", "user"];
}

/** Keeps a chosen scope when the harness allows it, otherwise the first one it does. */
export function coerceScope(
  kind: CustomizationKind,
  harness: CustomizationHarness,
  scope: CustomizationScope,
): CustomizationScope {
  const scopes = availableScopes(kind, harness);
  return scopes.includes(scope) ? scope : (scopes[0] ?? "workspace");
}

/** The harness a workspace's current session runs on, from its provider instance id. */
export function harnessFromProviderInstance(
  instanceId: string | null | undefined,
): CustomizationHarness {
  return instanceId?.toLowerCase().includes("codex") ? "codex" : "claude";
}

function root(cwd: string): string {
  return cwd.replaceAll("\\", "/").replace(/\/+$/, "");
}

function skillTemplate(slug: string): string {
  return `---\nname: ${slug}\ndescription: <one line: what it does and when to use it>\n---\n\n# ${titleFromSlug(slug)}\n`;
}

function claudeAgentTemplate(slug: string): string {
  return `---\nname: ${slug}\ndescription: <one line: what it does and when to delegate to it>\n# tools: Read, Grep, Glob\n# model: sonnet\n---\n\nYou are a specialist. Describe how this agent should work.\n`;
}

function codexPromptTemplate(slug: string): string {
  return `---\ndescription: <one line: what this prompt does>\nargument-hint: [arguments]\n---\n\n# ${titleFromSlug(slug)}\n`;
}

/**
 * The file a "+" creates, or `null` when a skill or agent has no usable name yet.
 * `scope` must be one of `availableScopes` (use `coerceScope`).
 */
export function planNewCustomization(
  request: NewCustomizationRequest,
): NewCustomizationPlan | null {
  const { kind, harness, scope, cwd } = request;
  const claudeBase = scope === "user" ? "~/.claude" : `${root(cwd)}/.claude`;
  const slug = slugify(request.name);

  if (kind === "instructions") {
    if (harness === "codex") {
      return {
        path: `${root(cwd)}/AGENTS.md`,
        contents: "# AGENTS.md\n",
        openIfExists: true,
        readOnly: false,
      };
    }
    const path = scope === "user" ? "~/.claude/CLAUDE.md" : `${root(cwd)}/CLAUDE.md`;
    return { path, contents: "# CLAUDE.md\n", openIfExists: true, readOnly: false };
  }

  if (kind === "mcp") {
    if (harness === "codex") {
      return { path: "~/.codex/config.toml", contents: "", openIfExists: true, readOnly: true };
    }
    return {
      path: `${root(cwd)}/.mcp.json`,
      contents: '{"mcpServers":{}}\n',
      openIfExists: true,
      readOnly: false,
    };
  }

  if (slug.length === 0) return null;

  if (kind === "skill") {
    const base = harness === "codex" ? "~/.codex" : claudeBase;
    return {
      path: `${base}/skills/${slug}/SKILL.md`,
      contents: skillTemplate(slug),
      openIfExists: false,
      readOnly: false,
    };
  }
  // Agents: Claude subagents, or Codex custom prompts.
  if (harness === "codex") {
    return {
      path: `~/.codex/prompts/${slug}.md`,
      contents: codexPromptTemplate(slug),
      openIfExists: false,
      readOnly: false,
    };
  }
  return {
    path: `${claudeBase}/agents/${slug}.md`,
    contents: claudeAgentTemplate(slug),
    openIfExists: false,
    readOnly: false,
  };
}
