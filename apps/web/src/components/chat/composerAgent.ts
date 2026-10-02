import type { CustomizationItem, ProviderOptionSelection } from "@t3tools/contracts";

/**
 * The agent a Claude Code session runs as (`--agent`) travels as an `agent`
 * entry in the model selection's options. It is not a model descriptor, so
 * it is carried beside the descriptor-built options instead of through them.
 */
export const CLAUDE_AGENT_OPTION_ID = "agent";

type Options = ReadonlyArray<ProviderOptionSelection> | null | undefined;

export function getChosenAgent(options: Options): string | null {
  const selection = options?.find((option) => option.id === CLAUDE_AGENT_OPTION_ID);
  return typeof selection?.value === "string" && selection.value.length > 0
    ? selection.value
    : null;
}

/** `options` with the chosen agent set (or cleared with `null`); undefined when nothing is left. */
export function withChosenAgent(
  options: Options,
  agent: string | null,
): ReadonlyArray<ProviderOptionSelection> | undefined {
  const rest = (options ?? []).filter((option) => option.id !== CLAUDE_AGENT_OPTION_ID);
  const next = agent ? [...rest, { id: CLAUDE_AGENT_OPTION_ID, value: agent }] : rest;
  return next.length > 0 ? next : undefined;
}

/** Keeps the chosen agent when a trait edit replaces the descriptor-built options. */
export function keepChosenAgent(
  next: Options,
  previous: Options,
): ReadonlyArray<ProviderOptionSelection> | undefined {
  return withChosenAgent(next, getChosenAgent(previous));
}

export const DEFAULT_AGENT_LABEL = "Claude Code";

/** "orchestrator" -> "Orchestrator", "code-reviewer" -> "Code Reviewer". */
export function formatAgentName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface ComposerAgentDisplay {
  /** The agent that will run, or null for plain Claude Code. */
  readonly agent: string | null;
  readonly label: string;
  /** Where the effective agent comes from, for the tooltip. */
  readonly source: "chosen" | "settings" | "default";
}

/** A chosen agent wins; otherwise the settings.json `agent` key; otherwise plain Claude Code. */
export function resolveComposerAgent(input: {
  readonly chosen: string | null;
  readonly settingsDefault: string | null | undefined;
}): ComposerAgentDisplay {
  if (input.chosen) {
    return { agent: input.chosen, label: formatAgentName(input.chosen), source: "chosen" };
  }
  if (input.settingsDefault) {
    return {
      agent: input.settingsDefault,
      label: formatAgentName(input.settingsDefault),
      source: "settings",
    };
  }
  return { agent: null, label: DEFAULT_AGENT_LABEL, source: "default" };
}

export interface AgentChoice {
  readonly name: string;
  readonly description: string | undefined;
}

/** Agent types a workspace offers; a workspace agent shadows a user agent of the same name. */
export function listAgentChoices(items: ReadonlyArray<CustomizationItem>): AgentChoice[] {
  const byName = new Map<string, CustomizationItem>();
  for (const item of items) {
    if (item.kind !== "agent") continue;
    const existing = byName.get(item.name);
    if (!existing || (existing.scope === "user" && item.scope === "workspace")) {
      byName.set(item.name, item);
    }
  }
  return [...byName.values()]
    .map((item) => ({ name: item.name, description: item.description }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}
