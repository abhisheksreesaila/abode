// @effect-diagnostics nodeBuiltinImport:off - skill folders are copied and swapped with plain fs calls (symlinks, rename).
/**
 * The real "Inherit": copies a skill folder from its source repo onto disk. Add-only: a skill the
 * person edited is never touched, and a skill removed upstream is never deleted here.
 */
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { SkillSourcesError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import {
  classifyLocal,
  folderHash,
  gitBlobSha,
  worstLocalState,
  type SnapshotSkill,
} from "./skillSourcesCore.ts";
import type { LocalSkillsShape, SkillSourceFetcherShape } from "./skillSourcesIO.ts";

export interface SkillInstallRequest {
  readonly source: { readonly name: string; readonly repo?: string };
  readonly changes: ReadonlyArray<{
    readonly kind: "new" | "updated" | "removed";
    readonly key: string;
    readonly name: string;
    /** The skill as upstream has it (the files and hash to install). */
    readonly skill: SnapshotSkill;
  }>;
}

const failed = (message: string) => new SkillSourcesError({ failure: "failed", message });

const toMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const safeRelative = (path: string) =>
  path !== "" &&
  !NodePath.isAbsolute(path) &&
  path.split("/").every((part) => part !== ".." && part !== "");

/** Folders already holding this skill (symlinks resolved, duplicates dropped), else the default place. */
const installTargets = async (
  dirs: ReadonlyArray<string>,
  defaultDir: string,
  name: string,
): Promise<string[]> => {
  const found = new Set<string>();
  for (const dir of dirs) {
    try {
      const real = await NodeFSP.realpath(NodePath.join(dir, name));
      await NodeFSP.stat(NodePath.join(real, "SKILL.md"));
      found.add(real);
    } catch {
      // not installed in this folder
    }
  }
  return found.size > 0 ? [...found] : [NodePath.join(defaultDir, name)];
};

/** Writes `files` over a copy of `target` and swaps it in, so a reader never sees half a skill. */
const writeSkillFolder = async (target: string, files: ReadonlyMap<string, string>) => {
  const parent = NodePath.dirname(target);
  await NodeFSP.mkdir(parent, { recursive: true });
  const stamp = `${process.pid}-${NodeCrypto.randomUUID().slice(0, 8)}`;
  const temp = NodePath.join(parent, `.${NodePath.basename(target)}.tmp-${stamp}`);
  const backup = NodePath.join(parent, `.${NodePath.basename(target)}.old-${stamp}`);
  let existed = true;
  try {
    await NodeFSP.cp(target, temp, { recursive: true });
  } catch {
    existed = false;
    await NodeFSP.mkdir(temp, { recursive: true });
  }
  try {
    for (const [path, content] of files) {
      const file = NodePath.join(temp, path);
      await NodeFSP.mkdir(NodePath.dirname(file), { recursive: true });
      await NodeFSP.writeFile(file, content, "utf8");
    }
    if (existed) await NodeFSP.rename(target, backup);
    try {
      await NodeFSP.rename(temp, target);
    } catch (cause) {
      if (existed) await NodeFSP.rename(backup, target);
      throw cause;
    }
  } catch (cause) {
    await NodeFSP.rm(temp, { recursive: true, force: true });
    throw cause;
  }
  if (existed) await NodeFSP.rm(backup, { recursive: true, force: true });
};

export const makeInstall =
  (deps: {
    readonly fetcher: SkillSourceFetcherShape;
    readonly local: LocalSkillsShape;
    readonly dirs: ReadonlyArray<string>;
    readonly defaultDir: string;
  }) =>
  (request: SkillInstallRequest): Effect.Effect<void, SkillSourcesError> =>
    Effect.gen(function* () {
      const repo = request.source.repo;
      if (repo === undefined) {
        return yield* failed(`${request.source.name} has no repo to install from.`);
      }
      const wanted = request.changes.filter((change) => change.kind !== "removed");

      // Check and fetch everything first, so a failure leaves no skill half done.
      const prepared: Array<{ name: string; targets: string[]; files: Map<string, string> }> = [];
      for (const { name, skill, key } of wanted) {
        const hashes = yield* deps.local.hashesFor(name, skill.files);
        const state = worstLocalState(hashes.map((hash) => classifyLocal(hash, skill)));
        if (state === "edited") {
          return yield* new SkillSourcesError({
            failure: "local_edited",
            message: `'${name}' was edited here; merge it instead of overwriting.`,
          });
        }
        if (!skill.files.every(safeRelative)) {
          return yield* failed(`'${name}' lists a file path that is not safe to write.`);
        }
        const files = new Map<string, string>();
        for (const file of skill.files) {
          const text = yield* deps.fetcher
            .file(repo, key === "." ? file : `${key}/${file}`)
            .pipe(Effect.mapError((error) => failed(error.message)));
          files.set(file, text);
        }
        const actual = folderHash(
          [...files].map(([path, text]) => ({
            path,
            sha: gitBlobSha(new TextEncoder().encode(text)),
          })),
        );
        if (actual !== skill.hash) {
          return yield* failed(
            `'${name}' changed upstream since the last check (or has binary files); check again.`,
          );
        }
        const targets = yield* Effect.tryPromise({
          try: () => installTargets(deps.dirs, deps.defaultDir, name),
          catch: (cause) => failed(toMessage(cause)),
        });
        prepared.push({ name, targets, files });
      }
      for (const { name, targets, files } of prepared) {
        for (const target of targets) {
          yield* Effect.tryPromise({
            try: () => writeSkillFolder(target, files),
            catch: (cause) => failed(`'${name}' not installed: ${toMessage(cause)}`),
          });
        }
      }
    });
