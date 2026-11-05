// @effect-diagnostics nodeBuiltinImport:off - streams multi-gigabyte session logs line by line.
/**
 * "Last used" for the Kit's Skills tab: Skill tool calls in Claude Code's transcripts
 * (`<claude config dir>/projects/**\/*.jsonl`), cached per file by size and mtime. Codex logs
 * have no skill-load record. The cache lives in the service, built once per server.
 */
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";

import type {
  SkillUsageEntry,
  SkillUsageListInput,
  SkillUsageListResult,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { foldUsage, mergeUsage, skillUsesInLine, type SkillUse } from "./skillUsageCore.ts";

class SkillUsage extends Context.Service<
  SkillUsage,
  { readonly list: (input: SkillUsageListInput) => Effect.Effect<SkillUsageListResult> }
>()("t3/abode/SkillUsage") {}

class LogReadError extends Schema.TaggedError<LogReadError>()("LogReadError", {
  cause: Schema.Defect(),
}) {}

interface CachedLog {
  readonly size: number;
  readonly mtimeMs: number;
  readonly entries: ReadonlyArray<SkillUsageEntry>;
}

export type LogReader = (
  file: string,
  signal: AbortSignal,
) => Promise<ReadonlyArray<SkillUsageEntry>>;

const defaultProjectsDir = () =>
  NodePath.join(
    process.env.CLAUDE_CONFIG_DIR?.trim() || NodePath.join(NodeOS.homedir(), ".claude"),
    "projects",
  );

async function listLogFiles(directory: string): Promise<ReadonlyArray<string>> {
  const entries = await NodeFSP.readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = NodePath.join(directory, entry.name);
      if (entry.isDirectory()) return listLogFiles(full);
      return entry.isFile() && entry.name.endsWith(".jsonl") ? [full] : [];
    }),
  );
  return nested.flat();
}

const readLogFile: LogReader = async (file, signal) => {
  const uses: Array<SkillUse> = [];
  const lines = NodeReadline.createInterface({
    input: NodeFS.createReadStream(file, { encoding: "utf8", signal }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) uses.push(...skillUsesInLine(line));
  return foldUsage(uses);
};

export const makeWith = Effect.fn("SkillUsage.make")(function* (
  options: { readonly projectsDir?: () => string; readonly readLog?: LogReader } = {},
) {
  const projectsDir = options.projectsDir ?? defaultProjectsDir;
  const readLog = options.readLog ?? readLogFile;
  const cache = new Map<string, CachedLog>();
  // One scan at a time: a caller that arrives mid-scan waits, then finds every log cached.
  const lock = yield* Semaphore.make(1);

  const scan = Effect.gen(function* () {
    const files = yield* Effect.tryPromise(() => listLogFiles(projectsDir())).pipe(
      Effect.orElseSucceed((): ReadonlyArray<string> => []),
    );
    for (const file of files) {
      const stat = yield* Effect.tryPromise(() => NodeFSP.stat(file)).pipe(
        Effect.orElseSucceed(() => null),
      );
      if (stat === null) continue;
      const cached = cache.get(file);
      if (cached?.size === stat.size && cached.mtimeMs === stat.mtimeMs) continue;
      const entries = yield* Effect.tryPromise({
        try: (signal) => readLog(file, signal),
        catch: (cause) => new LogReadError({ cause }),
      }).pipe(
        Effect.catch((cause) =>
          Effect.logWarning("skill usage: could not read a session log", {
            file,
            cause: cause.cause,
          }).pipe(Effect.as(null)),
        ),
      );
      // A log that failed to read is tried again next scan, never cached as empty.
      if (entries !== null) cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, entries });
      yield* Effect.yieldNow;
    }
    const present = new Set(files);
    for (const file of cache.keys()) if (!present.has(file)) cache.delete(file);
    return mergeUsage([...cache.values()].map((log) => log.entries));
  });

  return SkillUsage.of({
    list: Effect.fn("SkillUsage.list")(function* (input) {
      const skills = input.scan === true ? yield* lock.withPermits(1)(scan) : [];
      return { homePath: NodeOS.homedir(), scanned: input.scan === true, skills };
    }),
  });
});
