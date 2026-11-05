// @effect-diagnostics nodeBuiltinImport:off - streams multi-gigabyte session logs line by line.
/**
 * "Last used" for the Kit's Skills tab: reads Claude Code's own transcripts
 * (`<claude config dir>/projects/**\/*.jsonl`) for Skill tool calls. Per-file results are cached
 * by size and mtime, so after the first scan only new or grown logs are read again. Codex
 * sessions don't record skill loads as a tool call, so they are not read.
 */
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";

import {
  WS_METHODS,
  type SkillUsageEntry,
  type SkillUsageListInput,
  type SkillUsageListResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { foldUsage, mergeUsage, skillUsesInLine, type SkillUse } from "./skillUsageCore.ts";

interface CachedLog {
  readonly size: number;
  readonly mtimeMs: number;
  readonly entries: ReadonlyArray<SkillUsageEntry>;
}

const cache = new Map<string, CachedLog>();
let scanning: Promise<ReadonlyArray<SkillUsageEntry>> | null = null;

const projectsDir = () =>
  NodePath.join(
    process.env.CLAUDE_CONFIG_DIR?.trim() || NodePath.join(NodeOS.homedir(), ".claude"),
    "projects",
  );

async function* logFiles(directory: string): AsyncGenerator<string> {
  const entries = await NodeFSP.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = NodePath.join(directory, entry.name);
    if (entry.isDirectory()) yield* logFiles(full);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) yield full;
  }
}

async function readLog(file: string): Promise<ReadonlyArray<SkillUsageEntry>> {
  const uses: Array<SkillUse> = [];
  const lines = NodeReadline.createInterface({
    input: NodeFS.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) uses.push(...skillUsesInLine(line));
  return foldUsage(uses);
}

async function scan(): Promise<ReadonlyArray<SkillUsageEntry>> {
  const seen = new Set<string>();
  for await (const file of logFiles(projectsDir())) {
    seen.add(file);
    const stat = await NodeFSP.stat(file).catch(() => null);
    if (stat === null) continue;
    const cached = cache.get(file);
    if (cached?.size === stat.size && cached.mtimeMs === stat.mtimeMs) continue;
    const entries = await readLog(file).catch((): ReadonlyArray<SkillUsageEntry> => []);
    cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, entries });
  }
  for (const file of cache.keys()) if (!seen.has(file)) cache.delete(file);
  return mergeUsage([...cache.values()].map((log) => log.entries));
}

/** One scan at a time: a second caller waits for the one already running. */
function scanOnce() {
  scanning ??= scan().finally(() => {
    scanning = null;
  });
  return scanning;
}

export const list = (input: SkillUsageListInput): Effect.Effect<SkillUsageListResult> =>
  Effect.promise(async () => ({
    homePath: NodeOS.homedir(),
    scanned: input.scan === true,
    skills: input.scan === true ? await scanOnce() : [],
  }));

/** The `skillUsage.*` handlers, spread into `SkillSources.handlers`. */
export const handlers = () => ({
  [WS_METHODS.skillUsageList]: (input: SkillUsageListInput) => list(input),
});
