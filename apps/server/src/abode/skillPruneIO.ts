// @effect-diagnostics nodeBuiltinImport:off - skills are moved as whole folders or links with plain fs renames.
/**
 * "Prune by jam": moves skills out of the skill roots into `<first root>/.trash` and back. A skill
 * is cut from every root that holds it (a link and the folder it points at go together); a link is
 * moved as a link and its target is never opened for writing. Nothing outside the roots is touched,
 * and a restore never overwrites what now sits at the original path.
 */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import type { SkillPruneResult } from "@t3tools/contracts";

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

const readIndex = async (file: string): Promise<TrashIndex> => {
  try {
    const parsed: unknown = JSON.parse(await NodeFSP.readFile(file, "utf8"));
    if (
      (parsed as TrashIndex | null)?.version === 1 &&
      Array.isArray((parsed as TrashIndex).entries)
    ) {
      return parsed as TrashIndex;
    }
  } catch {
    // no index yet
  }
  return { version: 1, entries: [] };
};

const writeIndex = async (file: string, index: TrashIndex) => {
  const temp = `${file}.${process.pid}.tmp`;
  await NodeFSP.writeFile(temp, JSON.stringify(index), "utf8");
  await NodeFSP.rename(temp, file);
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

/** Moves back what `moved` took out, newest first; used when a cut fails half way. */
const undo = async (
  name: string,
  trashed: string,
  moved: ReadonlyArray<{ dir: string; slot: string }>,
) => {
  for (const item of moved.toReversed()) {
    await NodeFSP.rename(NodePath.join(trashed, item.slot), NodePath.join(item.dir, name)).catch(
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
  const roots = await realRoots(dirs);
  const trashDir = NodePath.join(dirs[0] ?? "", TRASH);
  const indexFile = NodePath.join(trashDir, INDEX);
  for (const name of new Set(names)) {
    if (!validSkillName(name)) {
      skipped.push({ name, reason: "not a skill name" });
      continue;
    }
    const where = await locate(dirs, roots, name);
    if (typeof where === "string") {
      skipped.push({ name, reason: where });
      continue;
    }
    // Links go first so no root holds a link to a folder that has already left.
    const ordered = where.dirs.toSorted((a, b) => Number(b.link) - Number(a.link));
    try {
      await NodeFSP.mkdir(trashDir, { recursive: true });
      let id = `${name}-${nowMs}`;
      for (let n = 1; await exists(NodePath.join(trashDir, id)); n += 1)
        id = `${name}-${nowMs}-${n}`;
      const trashed = NodePath.join(trashDir, id);
      await NodeFSP.mkdir(trashed);
      const items = ordered.map((item, position) => ({ dir: item.dir, slot: String(position) }));
      const moved: typeof items = [];
      try {
        for (const item of items) {
          await NodeFSP.rename(NodePath.join(item.dir, name), NodePath.join(trashed, item.slot));
          moved.push(item);
        }
      } catch (cause) {
        await undo(name, trashed, moved);
        await NodeFSP.rmdir(trashed).catch(() => undefined);
        throw cause;
      }
      const index = await readIndex(indexFile);
      await writeIndex(indexFile, {
        version: 1,
        entries: [...index.entries, { id, name, movedAt: nowMs, items }],
      });
      done.push(name);
    } catch (cause) {
      skipped.push({ name, reason: `could not move it (${toMessage(cause)})` });
    }
  }
  return { done, skipped };
}

export async function restoreSkills(
  dirs: ReadonlyArray<string>,
  names: ReadonlyArray<string>,
): Promise<SkillPruneResult> {
  const done: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  const trashDir = NodePath.join(dirs[0] ?? "", TRASH);
  const indexFile = NodePath.join(trashDir, INDEX);
  for (const name of new Set(names)) {
    if (!validSkillName(name)) {
      skipped.push({ name, reason: "not a skill name" });
      continue;
    }
    const index = await readIndex(indexFile);
    const entry = index.entries.findLast((candidate) => candidate.name === name);
    if (entry === undefined) {
      skipped.push({ name, reason: "nothing in the trash by that name" });
      continue;
    }
    // The index is a file in the person's home: only roots we know are ever written to.
    const known = entry.items.every((item) => dirs.includes(item.dir) && /^\d+$/.test(item.slot));
    if (!known || entry.id.startsWith(".") || entry.id !== NodePath.basename(entry.id)) {
      skipped.push({ name, reason: "the trash record is not one of ours" });
      continue;
    }
    const trashed = NodePath.join(trashDir, entry.id);
    const taken = await Promise.all(
      entry.items.map((item) => exists(NodePath.join(item.dir, name))),
    );
    if (taken.some(Boolean)) {
      skipped.push({ name, reason: "something is already there" });
      continue;
    }
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
        await NodeFSP.rename(NodePath.join(trashed, item.slot), NodePath.join(item.dir, name));
        moved.push(item);
      }
    } catch (cause) {
      for (const item of moved.toReversed()) {
        await NodeFSP.rename(
          NodePath.join(item.dir, name),
          NodePath.join(trashed, item.slot),
        ).catch(() => undefined);
      }
      skipped.push({ name, reason: `could not move it back (${toMessage(cause)})` });
      continue;
    }
    await NodeFSP.rmdir(trashed).catch(() => undefined);
    await writeIndex(indexFile, {
      version: 1,
      entries: index.entries.filter((candidate) => candidate.id !== entry.id),
    });
    done.push(name);
  }
  return { done, skipped };
}
