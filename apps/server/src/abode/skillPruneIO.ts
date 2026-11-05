// @effect-diagnostics nodeBuiltinImport:off - skills are moved as whole folders or links with plain fs renames.
/**
 * "Prune by jam": moves skills out of the skill roots into `<first root>/.trash` and back. A skill
 * is cut from every root that holds it (a link and the folder it points at go together); a link is
 * moved as a link and its target is never opened for writing. Nothing outside the roots is touched,
 * and a restore never overwrites what now sits at the original path.
 */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import type { SkillPruneResult, SkillTrashResult } from "@t3tools/contracts";

const TRASH = ".trash";
const INDEX = "index.json";

interface TrashItem {
  /** The skill root (as listed, not resolved) the skill was in; its path is `<dir>/<name>`. */
  readonly dir: string;
  /** The name it has inside the trash folder. */
  readonly slot: string;
}

interface TrashEntry {
  readonly id: string;
  readonly name: string;
  readonly movedAt: number;
  readonly items: ReadonlyArray<TrashItem>;
}

interface TrashIndex {
  readonly version: 1;
  readonly entries: ReadonlyArray<TrashEntry>;
}

const validSkillName = (name: string) =>
  name !== "" && !/[/\\\0]/.test(name) && !name.startsWith(".");

const toMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const moveFailure = (cause: unknown, direction: "to the trash" | "back") =>
  (cause as { code?: unknown } | null)?.code === "EXDEV"
    ? `on a different disk; can't move it ${direction}`
    : `could not move it (${toMessage(cause)})`;

const exists = (path: string) =>
  NodeFSP.lstat(path).then(
    () => true,
    () => false,
  );

const inside = (roots: ReadonlyArray<string>, path: string) =>
  roots.some((root) => path.startsWith(`${root}${NodePath.sep}`));

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

/** An entry is trusted only if it names one of our roots, numeric slots and a plain folder name. */
const trusted = (dirs: ReadonlyArray<string>, entry: TrashEntry): boolean =>
  typeof entry.id === "string" &&
  typeof entry.name === "string" &&
  validSkillName(entry.name) &&
  entry.id !== "" &&
  !entry.id.startsWith(".") &&
  entry.id === NodePath.basename(entry.id) &&
  Array.isArray(entry.items) &&
  entry.items.length > 0 &&
  entry.items.every(
    (item) => dirs.includes(item.dir) && typeof item.slot === "string" && /^\d+$/.test(item.slot),
  );

class IndexUnreadable extends Error {}

/** A missing index is an empty trash; an unreadable one is moved aside and the call refuses. */
const readIndex = async (file: string, nowMs: number | null): Promise<TrashIndex> => {
  let text: string;
  try {
    text = await NodeFSP.readFile(file, "utf8");
  } catch (cause) {
    if ((cause as { code?: unknown } | null)?.code === "ENOENT") {
      return { version: 1, entries: [] };
    }
    throw new IndexUnreadable(`the trash list could not be read (${toMessage(cause)})`);
  }
  try {
    const parsed = JSON.parse(text) as TrashIndex | null;
    if (parsed?.version === 1 && Array.isArray(parsed.entries)) return parsed;
  } catch {
    // falls through to the same refusal
  }
  if (nowMs === null) throw new IndexUnreadable("the trash list is unreadable");
  const aside = `${file}.bad-${nowMs}`;
  await NodeFSP.rename(file, aside).catch(() => undefined);
  throw new IndexUnreadable(
    `the trash list was unreadable, so it was moved aside to ${NodePath.basename(aside)}. Nothing was moved; try again`,
  );
};

const writeIndex = async (file: string, index: TrashIndex) => {
  const temp = `${file}.${process.pid}.tmp`;
  await NodeFSP.writeFile(temp, JSON.stringify(index), "utf8");
  await NodeFSP.rename(temp, file);
};

/** The trash folder under the first root: a real folder, not a link, inside the roots. */
const prepareTrash = async (trashDir: string, roots: ReadonlyArray<string>): Promise<void> => {
  const stat = await NodeFSP.lstat(trashDir).catch(() => null);
  if (stat?.isSymbolicLink()) throw new Error("the trash folder is a link; refusing to use it");
  if (stat === null) await NodeFSP.mkdir(trashDir, { recursive: true });
  const real = await NodeFSP.realpath(trashDir);
  if (!inside(roots, real)) throw new Error("the trash folder is outside your skill folders");
};

/** Where this skill sits in each root: the roots' entries, or why the name cannot be cut. */
const locate = async (
  dirs: ReadonlyArray<string>,
  roots: ReadonlyArray<string>,
  name: string,
): Promise<{ readonly dirs: ReadonlyArray<{ dir: string; link: boolean }> } | string> => {
  const found: Array<{ dir: string; link: boolean }> = [];
  for (const dir of dirs) {
    const slot = NodePath.join(dir, name);
    let link: boolean;
    try {
      link = (await NodeFSP.lstat(slot)).isSymbolicLink();
    } catch {
      continue;
    }
    let real: string;
    try {
      real = await NodeFSP.realpath(slot);
    } catch {
      continue; // a link that points nowhere is not a skill
    }
    if (!(await exists(NodePath.join(real, "SKILL.md")))) continue;
    if (!inside(roots, real)) return "lives outside your skill folders";
    found.push({ dir, link });
  }
  return found.length === 0 ? "not in your kit" : { dirs: found };
};

const refuseAll = (names: ReadonlyArray<string>, reason: string): SkillPruneResult => ({
  done: [],
  skipped: [...new Set(names)].map((name) => ({ name, reason })),
});

type Moved = ReadonlyArray<{ dir: string; slot: string }>;

/** Puts back what a half-done cut took out, newest first. */
const undoCut = async (name: string, trashed: string, moved: Moved) => {
  for (const item of moved.toReversed()) {
    await NodeFSP.rename(NodePath.join(trashed, item.slot), NodePath.join(item.dir, name)).catch(
      () => undefined,
    );
  }
};

/** Puts back in the trash what a half-done restore brought out. */
const undoRestore = async (name: string, trashed: string, moved: Moved) => {
  for (const item of moved.toReversed()) {
    await NodeFSP.rename(NodePath.join(item.dir, name), NodePath.join(trashed, item.slot)).catch(
      () => undefined,
    );
  }
};

export async function cutSkills(
  dirs: ReadonlyArray<string>,
  names: ReadonlyArray<string>,
  nowMs: number,
): Promise<SkillPruneResult> {
  const done: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const trashDir = NodePath.join(dirs[0] ?? "", TRASH);
  const indexFile = NodePath.join(trashDir, INDEX);
  let index: TrashIndex | null = null;
  for (const name of new Set(names)) {
    if (!validSkillName(name)) {
      skipped.push({ name, reason: "not a skill name" });
      continue;
    }
    const roots = await realRoots(dirs);
    const where = await locate(dirs, roots, name);
    if (typeof where === "string") {
      skipped.push({ name, reason: where });
      continue;
    }
    // Links go first so no root holds a link to a folder that has already left.
    const ordered = where.dirs.toSorted((a, b) => Number(b.link) - Number(a.link));
    try {
      await prepareTrash(trashDir, roots);
      index ??= await readIndex(indexFile, nowMs);
    } catch (cause) {
      if (cause instanceof IndexUnreadable) return refuseAll(names, cause.message);
      skipped.push({ name, reason: toMessage(cause) });
      continue;
    }
    let id = `${name}-${nowMs}`;
    for (let n = 1; await exists(NodePath.join(trashDir, id)); n += 1) id = `${name}-${nowMs}-${n}`;
    const trashed = NodePath.join(trashDir, id);
    const items = ordered.map((item, position) => ({ dir: item.dir, slot: String(position) }));
    const moved: Array<{ dir: string; slot: string }> = [];
    try {
      await NodeFSP.mkdir(trashed);
      for (const item of items) {
        await NodeFSP.rename(NodePath.join(item.dir, name), NodePath.join(trashed, item.slot));
        moved.push(item);
      }
      const next: TrashIndex = {
        version: 1,
        entries: [...index.entries, { id, name, movedAt: nowMs, items }],
      };
      await writeIndex(indexFile, next);
      index = next;
      done.push(name);
    } catch (cause) {
      await undoCut(name, trashed, moved);
      await NodeFSP.rmdir(trashed).catch(() => undefined);
      skipped.push({ name, reason: moveFailure(cause, "to the trash") });
    }
  }
  return { done, skipped };
}

export async function restoreSkills(
  dirs: ReadonlyArray<string>,
  names: ReadonlyArray<string>,
  nowMs = Date.now(),
): Promise<SkillPruneResult> {
  const done: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const trashDir = NodePath.join(dirs[0] ?? "", TRASH);
  const indexFile = NodePath.join(trashDir, INDEX);
  const trashStat = await NodeFSP.lstat(trashDir).catch(() => null);
  if (trashStat?.isSymbolicLink()) {
    return refuseAll(names, "the trash folder is a link; refusing to use it");
  }
  let index: TrashIndex;
  try {
    index = await readIndex(indexFile, nowMs);
  } catch (cause) {
    return refuseAll(names, toMessage(cause));
  }
  for (const name of new Set(names)) {
    if (!validSkillName(name)) {
      skipped.push({ name, reason: "not a skill name" });
      continue;
    }
    const entry = index.entries.findLast((candidate) => candidate.name === name);
    if (entry === undefined) {
      skipped.push({ name, reason: "nothing in the trash by that name" });
      continue;
    }
    // The index is a file in the person's home: only roots we know are ever written to.
    if (!trusted(dirs, entry)) {
      skipped.push({ name, reason: "the trash record is not one of ours" });
      continue;
    }
    const trashed = NodePath.join(trashDir, entry.id);
    // Folders first, links last, so a restored link never points at a missing folder.
    const slots = await Promise.all(
      entry.items.map(async (item) => ({
        item,
        link: (await NodeFSP.lstat(NodePath.join(trashed, item.slot))).isSymbolicLink(),
      })),
    ).catch(() => null);
    if (slots === null) {
      skipped.push({ name, reason: "the trashed copy is missing" });
      continue;
    }
    const moved: Array<{ dir: string; slot: string }> = [];
    try {
      for (const { item } of slots.toSorted((a, b) => Number(a.link) - Number(b.link))) {
        const target = NodePath.join(item.dir, name);
        // Checked right before each move; rename cannot refuse to replace, so keep the gap tiny.
        if (await exists(target)) throw new OccupiedError();
        await NodeFSP.rename(NodePath.join(trashed, item.slot), target);
        moved.push(item);
      }
      const next: TrashIndex = {
        version: 1,
        entries: index.entries.filter((candidate) => candidate.id !== entry.id),
      };
      await writeIndex(indexFile, next);
      index = next;
      await NodeFSP.rmdir(trashed).catch(() => undefined);
      done.push(name);
    } catch (cause) {
      await undoRestore(name, trashed, moved);
      skipped.push({
        name,
        reason:
          cause instanceof OccupiedError
            ? "something is already there"
            : moveFailure(cause, "back"),
      });
    }
  }
  return { done, skipped };
}

class OccupiedError extends Error {}

/** What is in the trash, newest first, for the Kit's "In trash" list. Read-only. */
export async function listTrash(dirs: ReadonlyArray<string>): Promise<SkillTrashResult> {
  const indexFile = NodePath.join(dirs[0] ?? "", TRASH, INDEX);
  const index = await readIndex(indexFile, null).catch((): TrashIndex => ({
    version: 1,
    entries: [],
  }));
  return {
    entries: index.entries
      .filter((entry) => trusted(dirs, entry))
      .map((entry) => ({
        name: entry.name,
        movedAt: entry.movedAt,
        paths: entry.items.map((item) => NodePath.join(item.dir, entry.name)),
      }))
      .toSorted((a, b) => b.movedAt - a.movedAt),
  };
}
