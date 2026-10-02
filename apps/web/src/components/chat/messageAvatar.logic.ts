/** Uppercase initial letters for a 24px avatar square. */
export function avatarInitials(name: string, maxLetters = 1): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = words.slice(0, maxLetters).map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export const DEFAULT_AGENT_NAME = "Claude";

export interface MessageIdentity {
  /** The active agent (F-021) or "Claude". */
  readonly agentName: string;
  /** "Opus 5.5 · full access" style detail for agent messages, or null. */
  readonly agentDetail: string | null;
}

export function resolveAgentName(chosenAgent: string | null | undefined): string {
  const name = chosenAgent?.trim();
  return name ? name : DEFAULT_AGENT_NAME;
}

/** "model · access", skipping whichever half is unknown. */
export function formatAgentDetail(
  modelLabel: string | null | undefined,
  accessLabel: string | null | undefined,
): string | null {
  const parts = [modelLabel?.trim(), accessLabel?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
