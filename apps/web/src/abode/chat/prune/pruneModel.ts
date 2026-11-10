/** The Kit agent's proposal: a fenced block tagged `abode-prune`, one `name | reason | tokens` line per skill. */

export const PRUNE_FENCE = "abode-prune";

export interface PruneRow {
  readonly name: string;
  readonly reason: string;
  /** What the agent said the skill costs per session; null when it gave none. */
  readonly tokens: number | null;
}

const NAME = /^[A-Za-z0-9][\w.:-]*$/;
const TOKENS = /^[~−-]?\s*(\d[\d,]*)\s*(?:tok(?:ens?)?)?$/i;

function parseLine(line: string): PruneRow | null {
  const parts = line
    .replace(/^\s*(?:[-*]\s+)?/, "")
    .split("|")
    .map((part) => part.trim());
  const name = (parts[0] ?? "").replace(/^`|`$/g, "");
  if (!NAME.test(name)) return null;
  const rest = parts.slice(1);
  const last = rest.at(-1);
  const match = last === undefined ? null : TOKENS.exec(last);
  if (match) rest.pop();
  return {
    name,
    reason: rest.join(" | "),
    tokens: match ? Number((match[1] ?? "").replaceAll(",", "")) : null,
  };
}

/** The rows of a block, in order; a name listed twice keeps its first line, odd lines are dropped. */
export function parsePruneBlock(code: string): ReadonlyArray<PruneRow> {
  const seen = new Set<string>();
  const rows: PruneRow[] = [];
  for (const line of code.split(/\r?\n/)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const row = parseLine(line);
    if (row === null || seen.has(row.name)) continue;
    seen.add(row.name);
    rows.push(row);
  }
  return rows;
}

/** The agent's figure, else what the Kit measured for the skill's copies added up, else nothing. */
export function rowTokens(row: PruneRow, measured: ReadonlyArray<number>): number {
  return row.tokens ?? measured.reduce((sum, tokens) => sum + tokens, 0);
}

export function pruneHeadline(count: number, tokens: number): string {
  return `I'd cut ${count} · saves ${tokens.toLocaleString("en-US")} tokens per session`;
}
