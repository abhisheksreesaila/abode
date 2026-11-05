import { PRUNE_FENCE } from "./pruneModel";

export interface PruneAskSkill {
  readonly name: string;
  readonly source: string;
  readonly tokens: number;
  /** "today", "10d ago", "unknown" … */
  readonly lastUsed: string;
}

const MAX_LISTED = 150;

/** What goes in the composer for "What don't I need?". It never sends; the person does. */
export function pruneAskPrompt(skills: ReadonlyArray<PruneAskSkill>): string {
  const listed = skills.slice(0, MAX_LISTED);
  return [
    "What don't I need? Pick the skills below I could cut without missing them: unused for a long time, or overlapping another skill.",
    `Answer with a short sentence, then ONE fenced block tagged ${PRUNE_FENCE}, one line per skill: \`name | reason | tokens\` (tokens = the number from the list). Use only names from the list. Don't move or delete anything; I'll tick and cut from the card.`,
    "",
    "name | source | tokens | last used",
    ...listed.map(
      (skill) => `${skill.name} | ${skill.source} | ${skill.tokens} | ${skill.lastUsed}`,
    ),
    ...(skills.length > listed.length
      ? [`(+${skills.length - listed.length} more not shown)`]
      : []),
  ].join("\n");
}
