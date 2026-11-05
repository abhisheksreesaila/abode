// @effect-diagnostics nodeBuiltinImport:off - skill folders are copied and swapped with plain fs calls (symlinks, rename).
/**
 * The real "Inherit": copies a skill folder from its source repo onto disk. Add-only: a skill the
 * person edited is never touched, a skill removed upstream is never deleted here, and nothing is
 * written outside the skill roots (a symlink out of them is refused, not followed).
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

const codeOf = (cause: unknown) => (cause as { code?: unknown } | null)?.code;

const safeRelative = (path: string) =>
  path !== "" &&
  !NodePath.isAbsolute(path) &&
  path.split("/").every((part) => part !== ".." && part !== "");

const validSkillName = (name: string) =>
  name !== "" && !/[/\\\0]/.test(name) && !name.startsWith(".");

const realRoots = async (dirs: ReadonlyArray<string>): Promise<string[]> => {
  const roots: string[] = [];
  for (const dir of dirs) {
    try {
      roots.push(await NodeFSP.realpath(dir));
    } catch {
      // a root that does not exist holds no skills
    }
  }
  return roots;
};

const inside = (roots: ReadonlyArray<string>, path: string) =>
  roots.some((root) => path.startsWith(`${root}${NodePath.sep}`));

/**
 * Folders already holding this skill (symlinks resolved, duplicates dropped), else the default
 * place. A copy whose real folder is not strictly inside one of the roots is refused.
 */
const installTargets = async (
  dirs: ReadonlyArray<string>,
  defaultDir: string,
  name: string,
): Promise<string[]> => {
  const roots = await realRoots(dirs);
  const found = new Set<string>();
  for (const dir of dirs) {
    let real: string;
    try {
      real = await NodeFSP.realpath(NodePath.join(dir, name));
      await NodeFSP.stat(NodePath.join(real, "SKILL.md"));
    } catch {
      continue; // not installed in this folder
    }
    if (!inside(roots, real)) {
      throw new Error(`${name} lives outside your skill folders (${real}); not updated`);
    }
    found.add(real);
  }
  if (found.size > 0) return [...found];
  const [defaultRoot] = await realRoots([defaultDir]);
  return [NodePath.join(defaultRoot ?? defaultDir, name)];
};

interface Staged {
  readonly target: string;
  readonly temp: string;
  readonly backup: string;
  readonly existed: boolean;
}

/** Makes `path` (inside `temp`) a regular file or folder if it is a link; the link's target is untouched. */
const unlinkInTemp = async (temp: string, file: string) => {
  const parts = NodePath.relative(temp, file).split(NodePath.sep);
  let current = temp;
  for (const [index, part] of parts.entries()) {
    current = NodePath.join(current, part);
    let stat;
    try {
      stat = await NodeFSP.lstat(current);
    } catch (cause) {
      if (codeOf(cause) === "ENOENT") return;
      throw cause;
    }
    if (!stat.isSymbolicLink()) continue;
    const isLast = index === parts.length - 1;
    if (isLast) {
      await NodeFSP.rm(current, { force: true });
      return;
    }
    // A linked folder becomes a real folder holding a copy of what it pointed at.
    let source: string | null = null;
    try {
      source = await NodeFSP.realpath(current);
    } catch {
      // dangling link
    }
    await NodeFSP.rm(current, { force: true });
    if (source === null) await NodeFSP.mkdir(current);
    else await NodeFSP.cp(source, current, { recursive: true, dereference: true });
  }
};

/** Builds the new folder next to `target` (a copy of it, with `files` written over); nothing is swapped yet. */
const stageSkillFolder = async (
  target: string,
  files: ReadonlyMap<string, string>,
): Promise<Staged> => {
  const parent = NodePath.dirname(target);
  await NodeFSP.mkdir(parent, { recursive: true });
  const stamp = `${process.pid}-${NodeCrypto.randomUUID().slice(0, 8)}`;
  const base = NodePath.basename(target);
  const temp = NodePath.join(parent, `.${base}.tmp-${stamp}`);
  const backup = NodePath.join(parent, `.${base}.old-${stamp}`);
  let existed = true;
  try {
    await NodeFSP.cp(target, temp, { recursive: true, verbatimSymlinks: true });
  } catch (cause) {
    if (codeOf(cause) !== "ENOENT") {
      await NodeFSP.rm(temp, { recursive: true, force: true });
      throw cause;
    }
    existed = false;
    await NodeFSP.mkdir(temp, { recursive: true });
  }
  try {
    for (const [path, content] of files) {
      const file = NodePath.join(temp, path);
      await unlinkInTemp(temp, file);
      await NodeFSP.mkdir(NodePath.dirname(file), { recursive: true });
      await NodeFSP.writeFile(file, content, "utf8");
    }
  } catch (cause) {
    await NodeFSP.rm(temp, { recursive: true, force: true });
    throw cause;
  }
  return { target, temp, backup, existed };
};

const discardStaged = (staged: Staged) => NodeFSP.rm(staged.temp, { recursive: true, force: true });

/** Swaps the staged folder in; returns a warning when the old copy could not be removed. */
const commitStaged = async (staged: Staged): Promise<string | undefined> => {
  const { target, temp, backup, existed } = staged;
  if (existed) await NodeFSP.rename(target, backup);
  try {
    await NodeFSP.rename(temp, target);
  } catch (cause) {
    if (existed) await NodeFSP.rename(backup, target);
    await discardStaged(staged);
    throw cause;
  }
  if (!existed) return undefined;
  try {
    await NodeFSP.rm(backup, { recursive: true, force: true });
  } catch (cause) {
    return `${target} updated, but the old copy ${backup} could not be removed: ${toMessage(cause)}`;
  }
  return undefined;
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

      const editedNow = Effect.fn("SkillInstaller.edited")(function* (
        name: string,
        skill: SnapshotSkill,
      ) {
        const hashes = yield* deps.local.hashesFor(name, skill.files);
        if (worstLocalState(hashes.map((hash) => classifyLocal(hash, skill))) === "edited") {
          return yield* new SkillSourcesError({
            failure: "local_edited",
            message: `'${name}' was edited here; merge it instead of overwriting.`,
          });
        }
      });

      // Check and fetch everything first, so a failure leaves no skill half done.
      const prepared: Array<{
        name: string;
        skill: SnapshotSkill;
        targets: string[];
        files: Map<string, string>;
      }> = [];
      for (const { name, skill, key } of wanted) {
        if (!validSkillName(name)) return yield* failed(`'${name}' is not a usable skill name.`);
        yield* editedNow(name, skill);
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
        prepared.push({ name, skill, targets, files });
      }

      const staged: Staged[] = [];
      const run = Effect.gen(function* () {
        for (const { name, targets, files } of prepared) {
          for (const target of targets) {
            staged.push(
              yield* Effect.tryPromise({
                try: () => stageSkillFolder(target, files),
                catch: (cause) => failed(`'${name}' not installed: ${toMessage(cause)}`),
              }),
            );
          }
        }
        // The person may have edited a skill while files were fetched; look again before swapping.
        for (const { name, skill } of prepared) yield* editedNow(name, skill);
        for (const entry of staged) {
          const warning = yield* Effect.tryPromise({
            try: () => commitStaged(entry),
            catch: (cause) => failed(`'${entry.target}' not installed: ${toMessage(cause)}`),
          });
          if (warning !== undefined) yield* Effect.logWarning(warning);
        }
      });
      yield* run.pipe(
        Effect.onError(() =>
          Effect.promise(() => Promise.all(staged.map((entry) => discardStaged(entry)))),
        ),
      );
    });
