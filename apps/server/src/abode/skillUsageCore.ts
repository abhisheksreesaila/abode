import type { SkillUsageEntry } from "@t3tools/contracts";

export interface SkillUse {
  readonly skill: string;
  readonly at: string;
}

const SKILL_TOOL_MARKER = '"name":"Skill"';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** `plugin:skill` and `/skill` both name the skill itself. */
const bareSkillName = (raw: string) => (raw.trim().split(":").at(-1) ?? "").replace(/^\//, "");

/**
 * The skills one Claude Code transcript line loaded: assistant lines whose content holds a
 * `Skill` tool call. The substring check skips the JSON parse for nearly every line of a log.
 */
export function skillUsesInLine(line: string): ReadonlyArray<SkillUse> {
  if (!line.includes(SKILL_TOOL_MARKER)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return [];
  }
  const entry = asRecord(parsed);
  const at = entry?.timestamp;
  const content = asRecord(entry?.message)?.content;
  if (entry?.type !== "assistant" || typeof at !== "string" || at === "") return [];
  if (!Array.isArray(content)) return [];
  const uses: Array<SkillUse> = [];
  for (const block of content) {
    const call = asRecord(block);
    if (call?.type !== "tool_use" || call.name !== "Skill") continue;
    const raw = asRecord(call.input)?.skill;
    const skill = typeof raw === "string" ? bareSkillName(raw) : "";
    if (skill !== "") uses.push({ skill, at });
  }
  return uses;
}

/** Latest time and use count per skill, most recently used first. */
export function foldUsage(uses: ReadonlyArray<SkillUse>): ReadonlyArray<SkillUsageEntry> {
  return mergeUsage([uses.map((use) => ({ name: use.skill, lastUsedAt: use.at, uses: 1 }))]);
}

/** Combines per-log results (each already folded) into one list. */
export function mergeUsage(
  groups: ReadonlyArray<ReadonlyArray<SkillUsageEntry>>,
): ReadonlyArray<SkillUsageEntry> {
  const byName = new Map<string, SkillUsageEntry>();
  for (const entry of groups.flat()) {
    const known = byName.get(entry.name);
    byName.set(
      entry.name,
      known === undefined
        ? entry
        : {
            name: entry.name,
            lastUsedAt: entry.lastUsedAt > known.lastUsedAt ? entry.lastUsedAt : known.lastUsedAt,
            uses: known.uses + entry.uses,
          },
    );
  }
  return [...byName.values()].toSorted((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}
