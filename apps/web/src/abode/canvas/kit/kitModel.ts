import type { CustomizationHarness, CustomizationItem } from "@t3tools/contracts";

export type SourceId = "matt" | "gstack" | "pstack" | "tstack" | "anth" | "mine";

/** `total` is each pack's published size, written down by hand; it is not read from the repos. */
export const SOURCES: Record<
  SourceId,
  { readonly name: string; readonly by: string; readonly color: string; readonly total: number }
> = {
  matt: { name: "Matt Pocock", by: "mattpocock/skills", color: "#5aa2ff", total: 25 },
  gstack: { name: "gstack", by: "Garry Tan · garrytan/gstack", color: "#ff7a1a", total: 31 },
  pstack: { name: "pstack", by: "poteto · Cursor plugin + ports", color: "#b18cff", total: 47 },
  tstack: { name: "tstack", by: "Theo · t3dotgg/tstack", color: "#f43f8e", total: 9 },
  anth: { name: "Anthropic", by: "built in", color: "#e07a52", total: 0 },
  mine: { name: "Mine", by: "~/.claude/skills", color: "#e4e4e7", total: 0 },
};

const MATT_SKILLS = new Set([
  "tdd",
  "grill-me",
  "grilling",
  "wayfinder",
  "to-tickets",
  "to-spec",
  "diagnosing-bugs",
  "prototype",
  "handoff",
  "domain-modeling",
  "code-review",
  "research",
  "pr",
  "wizard",
  "zoom-out",
]);

const ANTHROPIC_SKILLS = new Set([
  "skill-creator",
  "frontend-design",
  "claude-api",
  "init",
  "security-review",
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "simplify",
  "loop",
  "schedule",
  "update-config",
  "keybindings-help",
  "run",
]);

/** The path names the pack when it lives in one; otherwise the skill's name is matched against the known packs. */
export function detectSource(skill: { readonly name: string; readonly path: string }): SourceId {
  const segments = skill.path.toLowerCase().split(/[\\/]/);
  if (segments.includes("gstack")) return "gstack";
  if (segments.includes("pstack")) return "pstack";
  if (segments.includes("tstack")) return "tstack";
  if (segments.includes("mattpocock") || segments.includes("mattpocock-skills")) return "matt";
  if (segments.includes("anthropics") || segments.includes("claude-plugins-official")) {
    return "anth";
  }
  const name = skill.name.toLowerCase();
  if (MATT_SKILLS.has(name)) return "matt";
  if (ANTHROPIC_SKILLS.has(name)) return "anth";
  return "mine";
}

export type CategoryId =
  | "design"
  | "plan"
  | "build"
  | "review"
  | "test"
  | "security"
  | "ship"
  | "debug"
  | "guard"
  | "docs"
  | "care"
  | "other";

export const CATEGORIES: ReadonlyArray<{
  readonly id: CategoryId;
  readonly label: string;
  readonly color: string;
}> = [
  { id: "design", label: "Design", color: "#ff7eb6" },
  { id: "plan", label: "Plan", color: "#7aa2ff" },
  { id: "build", label: "Build", color: "#3ecf8e" },
  { id: "review", label: "Review", color: "#ffd166" },
  { id: "test", label: "Test & QA", color: "#4dd4c6" },
  { id: "security", label: "Security", color: "#ff5a5f" },
  { id: "ship", label: "Ship & PRs", color: "#c3a6ff" },
  { id: "debug", label: "Debug", color: "#ffa94d" },
  { id: "guard", label: "Guardrails", color: "#94a3b8" },
  { id: "docs", label: "Writing", color: "#a3e635" },
  { id: "care", label: "Kit care", color: "#e4e4e7" },
  { id: "other", label: "Other", color: "#7c7c86" },
];

const CATEGORY_KEYWORDS: ReadonlyArray<readonly [CategoryId, RegExp]> = [
  ["security", /\b(security|owasp|vulnerab|hardening|threat)/],
  ["debug", /\b(debug|diagnos|investigat|root cause|crash)/],
  ["test", /\b(qa|test|benchmark|playwright)/],
  ["review", /\breview/],
  ["ship", /\b(ship|deploy|release|pull request|pr\b|launch|merge)/],
  ["design", /\b(design|ui\b|ux\b|css|visual|mockup|stitch|figma|layout)/],
  ["plan", /\b(plan|spec|ticket|brief|roadmap|grill|clarif|decompos)/],
  ["guard", /\b(guard|careful|safety|constraint|principle)/],
  ["docs", /\b(doc|writing|prose|handoff|summar|markdown|pdf|readme)/],
  ["care", /\b(skill|kit|reflect|lesson|memory)/],
  ["build", /\b(build|implement|code|refactor|tdd|api|backend|database|sql)/],
];

/** The name decides first; the description only when the name says nothing. */
export function categorise(name: string, description: string | undefined): CategoryId {
  const lowerName = name.toLowerCase();
  const byName = CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(lowerName));
  if (byName) return byName[0];
  const text = `${lowerName} ${description ?? ""}`.toLowerCase();
  return CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

export interface KitSkill {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly source: SourceId;
  readonly category: CategoryId;
  readonly harnesses: ReadonlyArray<CustomizationHarness>;
}

/** One entry per skill name; the Claude copy is the one opened when both agents have it. */
export function buildKitSkills(items: ReadonlyArray<CustomizationItem>): ReadonlyArray<KitSkill> {
  const byName = new Map<
    string,
    { item: CustomizationItem; harnesses: Set<CustomizationHarness> }
  >();
  for (const item of items) {
    if (item.kind !== "skill") continue;
    const harness = item.harness ?? "claude";
    const entry = byName.get(item.name);
    if (!entry) {
      byName.set(item.name, { item, harnesses: new Set([harness]) });
      continue;
    }
    entry.harnesses.add(harness);
    if (harness === "claude") entry.item = item;
  }
  return [...byName.values()]
    .map(({ item, harnesses }) => ({
      name: item.name,
      description: item.description ?? "",
      path: item.path,
      source: detectSource(item),
      category: categorise(item.name, item.description),
      harnesses: (["claude", "codex"] as const).filter((harness) => harnesses.has(harness)),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Separate Claude-side folders holding a skill of this name (say `~/.claude/skills/x` and a real
 * `~/.agents/skills/x`). Links to one folder are listed once, so this is not inflated by them.
 */
export function skillCopies(
  items: ReadonlyArray<CustomizationItem>,
  name: string,
): ReadonlyArray<CustomizationItem> {
  return items.filter(
    (item) =>
      item.kind === "skill" && item.name === name && (item.harness ?? "claude") === "claude",
  );
}

/** One MCP row per server name, with every agent that declares it. */
export interface KitMcp {
  readonly name: string;
  readonly agents: ReadonlyArray<CustomizationHarness>;
  readonly scopes: ReadonlyArray<"user" | "workspace">;
  /** The files that declare it, absolute. */
  readonly paths: ReadonlyArray<string>;
}

/** Codex lists its `config.toml` as one file, not as servers, so it has no rows here. */
export function buildKitMcp(items: ReadonlyArray<CustomizationItem>): ReadonlyArray<KitMcp> {
  const byName = new Map<
    string,
    { agents: Set<CustomizationHarness>; scopes: Set<"user" | "workspace">; paths: Set<string> }
  >();
  for (const item of items) {
    if (item.kind !== "mcp" || item.name === "config.toml") continue;
    const entry = byName.get(item.name) ?? {
      agents: new Set(),
      scopes: new Set(),
      paths: new Set(),
    };
    entry.agents.add(item.harness ?? "claude");
    entry.scopes.add(item.scope);
    entry.paths.add(item.path);
    byName.set(item.name, entry);
  }
  return [...byName.entries()]
    .map(([name, entry]) => ({
      name,
      agents: (["claude", "codex"] as const).filter((agent) => entry.agents.has(agent)),
      scopes: (["user", "workspace"] as const).filter((scope) => entry.scopes.has(scope)),
      paths: [...entry.paths],
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** Tool counts aren't on the wire, so each MCP server is priced at a flat guess. */
const MCP_TOKENS_ESTIMATE = 1500;
const SKILL_OVERHEAD_TOKENS = 20;

/** What one skill's name and description cost in every session. */
export function skillTokens(skill: Pick<KitSkill, "name" | "description">): number {
  return SKILL_OVERHEAD_TOKENS + Math.ceil((skill.name.length + skill.description.length) / 4);
}

export function estimateContext(skills: ReadonlyArray<KitSkill>, mcpServers: number) {
  const skillTokenTotal = skills.reduce((sum, skill) => sum + skillTokens(skill), 0);
  const skillsK = skillTokenTotal / 1000;
  const mcpK = (mcpServers * MCP_TOKENS_ESTIMATE) / 1000;
  return { skillsK, mcpK, totalK: skillsK + mcpK };
}

export type HookEvent = "before" | "after" | "start" | "stop" | "other";

export interface KitHook {
  readonly event: HookEvent;
  readonly eventName: string;
  readonly matcher: string;
  readonly command: string;
}

export const HOOK_EVENT_COLOR: Record<HookEvent, string> = {
  before: "#ffd166",
  after: "#3ecf8e",
  start: "#7aa2ff",
  stop: "#c3a6ff",
  other: "#a1a1aa",
};

const HOOK_EVENTS: Record<string, HookEvent> = {
  PreToolUse: "before",
  UserPromptSubmit: "before",
  PreCompact: "before",
  PostToolUse: "after",
  SessionStart: "start",
  Stop: "stop",
  SubagentStop: "stop",
  SessionEnd: "stop",
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseSettings(text: string): Record<string, unknown> | null {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();
  return record(parsed);
}

/** Hides env-var values and token-looking arguments before a hook command is shown. */
export function maskCommand(command: string): string {
  return command
    .replace(/^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, (prefix) =>
      prefix.replace(/([A-Za-z_][A-Za-z0-9_]*)=\S*/g, "$1=•••"),
    )
    .replace(/(--?[\w-]*(?:token|key|secret|password|auth)[\w-]*)(\s+|=)[^\s'"]+/gi, "$1$2•••")
    .replace(/\b(Bearer)\s+[^\s'"]+/gi, "$1 •••");
}

/** The `hooks` of a Claude `settings.json`: event, matcher and command, in file order. */
export function parseHooks(settingsText: string): ReadonlyArray<KitHook> {
  const hooks = record(parseSettings(settingsText)?.hooks);
  if (!hooks) return [];
  const rows: Array<KitHook> = [];
  for (const [eventName, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const entry = record(group);
      const commands: ReadonlyArray<unknown> = Array.isArray(entry?.hooks) ? entry.hooks : [];
      for (const hook of commands) {
        const command = record(hook)?.command;
        if (typeof command !== "string" || command.trim() === "") continue;
        rows.push({
          event: HOOK_EVENTS[eventName] ?? "other",
          eventName,
          matcher: typeof entry?.matcher === "string" ? entry.matcher : "",
          command: maskCommand(command.trim()),
        });
      }
    }
  }
  return rows;
}

export interface KitPlugin {
  readonly name: string;
  readonly marketplace: string;
  readonly enabled: boolean;
}

/** `enabledPlugins` is `{ "name@marketplace": true | false }`. */
export function parsePlugins(settingsText: string): ReadonlyArray<KitPlugin> {
  const plugins = record(parseSettings(settingsText)?.enabledPlugins);
  if (!plugins) return [];
  return Object.entries(plugins)
    .map(([key, enabled]) => {
      const at = key.lastIndexOf("@");
      return {
        name: at > 0 ? key.slice(0, at) : key,
        marketplace: at > 0 ? key.slice(at + 1) : "",
        enabled: enabled === true,
      };
    })
    .toSorted((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
}
