import type { SkillChange, SkillSourceStatus, SkillSourcesState } from "@t3tools/contracts";

/** What is waiting across every source: the number on the Updates tab and on Kit. */
export function pendingCount(state: SkillSourcesState | null | undefined): number {
  return state?.sources.reduce((sum, source) => sum + source.changes.length, 0) ?? 0;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "agent",
  "also",
  "and",
  "any",
  "are",
  "claude",
  "code",
  "for",
  "from",
  "have",
  "into",
  "need",
  "not",
  "skill",
  "that",
  "the",
  "this",
  "use",
  "user",
  "uses",
  "when",
  "with",
  "you",
  "your",
]);

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

const DESCRIPTION_WORDS_SHARED = 4;

/**
 * The kit skill a new skill most likely repeats: the same name, a distinctive word of the name
 * in common (`grill-me` and `grilling`), or four distinctive description words in common.
 * Null when nothing looks alike.
 */
export function overlapHint(
  skill: { readonly name: string; readonly description: string },
  kit: ReadonlyArray<{ readonly name: string; readonly description: string }>,
): string | null {
  const nameWords = new Set(words(skill.name).map(stem));
  const descWords = new Set(words(skill.description).filter((word) => word.length >= 5));
  let best: { name: string; score: number } | null = null;
  for (const other of kit) {
    if (other.name.toLowerCase() === skill.name.toLowerCase()) return other.name;
    const sharedName = words(other.name).filter((word) => nameWords.has(stem(word))).length;
    const sharedDesc = new Set(words(other.description).filter((word) => descWords.has(word))).size;
    const score =
      sharedName > 0 ? 100 + sharedName : sharedDesc >= DESCRIPTION_WORDS_SHARED ? sharedDesc : 0;
    if (score > 0 && (best === null || score > best.score)) best = { name: other.name, score };
  }
  return best?.name ?? null;
}

/** Crude stem so "grill" and "grilling" meet. */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "");
}

export interface SourceGroups {
  readonly fresh: ReadonlyArray<SkillChange>;
  /** Updated or removed upstream, with no local edit: "Take all" covers these. */
  readonly takeAll: ReadonlyArray<SkillChange>;
  /** Changed upstream and edited here: merged by jam, never overwritten. */
  readonly edited: ReadonlyArray<SkillChange>;
}

export function groupChanges(changes: ReadonlyArray<SkillChange>): SourceGroups {
  return {
    fresh: changes.filter((change) => change.kind === "new" && change.local !== "edited"),
    takeAll: changes.filter((change) => change.kind !== "new" && change.local !== "edited"),
    edited: changes.filter((change) => change.local === "edited"),
  };
}

const plural = (count: number, one: string, other = `${one}s`) =>
  `${count} ${count === 1 ? one : other}`;

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });

/** "3 changes since Nov 2" (from the last decision), else "3 changes · checked Nov 4". */
export function sourceSummary(source: SkillSourceStatus): string {
  const count = plural(source.changes.length, "change");
  const decided = source.decisions[0]?.decidedAt;
  if (decided !== undefined) return `${count} since ${dayLabel(decided)}`;
  return source.lastOkAt === undefined ? count : `${count} · checked ${dayLabel(source.lastOkAt)}`;
}

export interface UpdatesFooter {
  /** Supported sources with nothing waiting. */
  readonly quiet: ReadonlyArray<string>;
  readonly skipped: number;
}

export function updatesFooter(state: SkillSourcesState): UpdatesFooter {
  const skipped = new Set(
    state.sources.flatMap((source) =>
      source.decisions
        .filter((decision) => decision.decision === "skip")
        .map((decision) => `${source.id}:${decision.key}`),
    ),
  );
  return {
    quiet: state.sources
      .filter(
        (source) => source.supported && source.changes.length === 0 && source.failure === undefined,
      )
      .map((source) => source.name),
    skipped: skipped.size,
  };
}

/** "2 updated · 1 removed upstream": the Take all card's title. */
export function takeAllTitle(changes: ReadonlyArray<Pick<SkillChange, "kind">>): string {
  const removed = changes.filter((change) => change.kind === "removed").length;
  const updated = changes.length - removed;
  return [
    updated > 0 ? `${updated} updated` : null,
    removed > 0 ? `${removed} removed upstream` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/** The prompt "Merge in jam" puts in the composer; the person sends it. */
export function mergePrompt(input: {
  readonly sourceName: string;
  readonly repo: string | undefined;
  readonly change: Pick<SkillChange, "key" | "name">;
  /** Where the client saw the installed copy (the Customizations list), when it did. */
  readonly localPath?: string | undefined;
}): string {
  const { change, repo, sourceName, localPath } = input;
  const upstream = repo === undefined ? sourceName : `${repo}`;
  const where = change.key === "." ? "the repo root" : `\`${change.key}\``;
  const mine =
    localPath === undefined
      ? "the installed copy (check ~/.claude/skills, ~/.agents/skills, ~/.codex/skills)"
      : `\`${localPath}\``;
  return [
    `Please do a 3-way merge of the skill "${change.name}".`,
    `Upstream: ${upstream} (${sourceName}), skill folder ${where} on the default branch.`,
    `My copy: ${mine} (it may be a symlink; edit the real folder it points to).`,
    "I edited it and upstream changed it too. Keep my edits, bring in upstream's changes, show me the diff before you write anything, and don't touch other skills.",
  ].join("\n");
}

/** "Matt Pocock added 3 skills, updated 1": one feed line per source with news. */
export function kitFeedText(
  sourceName: string,
  changes: ReadonlyArray<Pick<SkillChange, "kind">>,
): string {
  const count = (kind: SkillChange["kind"]) =>
    changes.filter((change) => change.kind === kind).length;
  const parts = [
    count("new") > 0 ? `added ${plural(count("new"), "skill")}` : null,
    count("updated") > 0 ? `updated ${count("updated")}` : null,
    count("removed") > 0 ? `removed ${count("removed")}` : null,
  ].filter((part) => part !== null);
  return `${sourceName} ${parts.join(", ")}`;
}
