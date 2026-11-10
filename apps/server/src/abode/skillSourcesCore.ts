// @effect-diagnostics nodeBuiltinImport:off globalDate:off - Effect has no incremental digest, and "06:00 local" needs the local-time Date.
/**
 * Pure rules of the daily skill-source check: finding skills in a repo tree, hashing them the way
 * git does (so an installed copy can be compared with upstream without downloading it), diffing
 * snapshots, and deciding when the next check is due. No I/O lives here.
 */
import * as NodeCrypto from "node:crypto";

import type { SkillChange, SkillLocalState } from "@t3tools/contracts";
import { parse as parseYaml } from "yaml";

export interface TreeEntry {
  readonly path: string;
  readonly type: "blob" | "tree";
  readonly sha: string;
}

export interface FolderFile {
  /** Path relative to the skill folder, `/` separated. */
  readonly path: string;
  /** Git blob sha of the file's bytes. */
  readonly sha: string;
}

export interface FoundSkill {
  /** Folder path inside the repo (`.` for a SKILL.md at the root). */
  readonly key: string;
  readonly name: string;
  readonly files: ReadonlyArray<FolderFile>;
}

export interface SnapshotSkill {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly tokens: number;
  readonly hash: string;
  /** Files (relative to the skill folder) the hash covers. */
  readonly files: ReadonlyArray<string>;
  /** Hashes upstream has had, newest last, so an installed older copy is "outdated", not "edited". */
  readonly knownHashes: ReadonlyArray<string>;
}

export type Snapshot = Readonly<Record<string, SnapshotSkill>>;

const KNOWN_HASHES_KEPT = 8;
const SKIPPED_SEGMENTS = new Set(["node_modules", ".git"]);

const sha1 = (data: string | Uint8Array) =>
  NodeCrypto.createHash("sha1").update(data).digest("hex");

/** The sha git gives a file's contents, so local files compare with the GitHub tree's `sha`. */
export const gitBlobSha = (content: Uint8Array): string => {
  const header = Buffer.from(`blob ${content.byteLength}\0`);
  return NodeCrypto.createHash("sha1").update(header).update(content).digest("hex");
};

/** One hash for a whole skill folder: its files' names and contents, in a fixed order. */
export const folderHash = (files: ReadonlyArray<FolderFile>): string =>
  sha1(
    [...files]
      .toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .map((file) => `${file.path}\0${file.sha}\n`)
      .join(""),
  );

/**
 * Every folder with a SKILL.md under `prefix`, with the files inside it. Hidden folders and
 * node_modules never hold skills. A folder nested in another skill's folder is its own skill and
 * its files do not count toward the outer one.
 */
export const findSkills = (
  entries: ReadonlyArray<TreeEntry>,
  options: { readonly prefix?: string; readonly rootName: string },
): ReadonlyArray<FoundSkill> => {
  const prefix = options.prefix ? `${options.prefix.replace(/\/+$/, "")}/` : "";
  const blobs = entries
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
    .map((entry) => ({ ...entry, rel: entry.path.slice(prefix.length) }))
    .filter((entry) =>
      entry.rel.split("/").every((part) => !SKIPPED_SEGMENTS.has(part) && !part.startsWith(".")),
    );
  const dirs = blobs
    .filter((entry) => entry.rel === "SKILL.md" || entry.rel.endsWith("/SKILL.md"))
    .map((entry) => entry.rel.slice(0, -"SKILL.md".length).replace(/\/$/, ""));
  const dirSet = new Set(dirs);
  return dirs
    .toSorted()
    .map((dir) => {
      const own = blobs.filter((entry) => {
        // A SKILL.md at the repo root is the whole repo's skill; only that file is the skill.
        if (dir === "") return entry.rel === "SKILL.md";
        if (!entry.rel.startsWith(`${dir}/`)) return false;
        const inside = entry.rel.slice(dir.length + 1);
        const parts = inside.split("/");
        // A deeper folder that is a skill of its own does not belong to this one.
        for (let i = 1; i < parts.length; i += 1) {
          const nested = [dir, ...parts.slice(0, i)].join("/");
          if (dirSet.has(nested)) return false;
        }
        return true;
      });
      const key = dir === "" ? "." : `${prefix}${dir}`;
      const name = dir === "" ? options.rootName : (dir.split("/").at(-1) ?? dir);
      return {
        key,
        name,
        files: own.map((entry) => ({
          path: dir === "" ? entry.rel : entry.rel.slice(dir.length + 1),
          sha: entry.sha,
        })),
      };
    })
    .filter((skill) => skill.files.length > 0);
};

/** Name and description from a SKILL.md's front matter; unreadable front matter gives an empty description. */
export const parseSkillMd = (text: string): { name?: string; description: string } => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return { description: "" };
  try {
    const data: unknown = parseYaml(match[1] ?? "");
    if (typeof data !== "object" || data === null) return { description: "" };
    const record = data as Record<string, unknown>;
    const description =
      typeof record.description === "string" ? record.description.replace(/\s+/g, " ").trim() : "";
    return typeof record.name === "string" && record.name.trim() !== ""
      ? { name: record.name.trim(), description }
      : { description };
  } catch {
    return { description: "" };
  }
};

/** Same estimate as the Kit window's context meter: what the harness loads before the skill is used. */
export const estimateTokens = (name: string, description: string): number =>
  20 + Math.ceil((name.length + description.length) / 4);

export const withKnownHash = (
  previous: SnapshotSkill | undefined,
  hash: string,
): ReadonlyArray<string> => {
  const known = previous?.knownHashes ?? [];
  return (known.at(-1) === hash ? known : [...known.filter((h) => h !== hash), hash]).slice(
    -KNOWN_HASHES_KEPT,
  );
};

/** How an installed copy relates to upstream. `localHash` is null when no copy is installed. */
export const classifyLocal = (
  localHash: string | null,
  skill: Pick<SnapshotSkill, "hash" | "knownHashes">,
): SkillLocalState => {
  if (localHash === null) return "none";
  if (localHash === skill.hash) return "same";
  return skill.knownHashes.includes(localHash) ? "outdated" : "edited";
};

/** The worst state across several installed copies (an edited one anywhere blocks an overwrite). */
export const worstLocalState = (states: ReadonlyArray<SkillLocalState>): SkillLocalState => {
  for (const state of ["edited", "outdated", "same"] as const) {
    if (states.includes(state)) return state;
  }
  return "none";
};

export interface RawChange {
  readonly kind: SkillChange["kind"];
  /** The skill as it is upstream now (`new`, `updated`) or as it was last accepted (`removed`). */
  readonly skill: SnapshotSkill;
}

const KIND_ORDER = { new: 0, updated: 1, removed: 2 } as const;

/** New, updated and removed skills in `latest` compared with what the person last accepted. */
export const diffSnapshots = (baseline: Snapshot, latest: Snapshot): ReadonlyArray<RawChange> => {
  const changes: RawChange[] = [];
  for (const skill of Object.values(latest)) {
    const before = baseline[skill.key];
    if (before === undefined) changes.push({ kind: "new", skill });
    else if (before.hash !== skill.hash) changes.push({ kind: "updated", skill });
  }
  for (const skill of Object.values(baseline)) {
    if (latest[skill.key] === undefined) changes.push({ kind: "removed", skill });
  }
  return changes.toSorted(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.skill.name < b.skill.name ? -1 : a.skill.name > b.skill.name ? 1 : 0),
  );
};

const HOUR_MS = 3_600_000;
const CHECK_HOUR = 6;
/** A check that is overdue (never run, or a 06:00 passed since the last one) waits this long after start. */
export const STARTUP_CHECK_DELAY_MS = 30_000;

const todayAt = (nowMs: number, hour: number): number => {
  const date = new Date(nowMs);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};

/**
 * Milliseconds until the next check: the next local 06:00, or a short delay when the last attempt
 * is older than the most recent 06:00 (the host was off at that time).
 */
export const msUntilNextCheck = (
  nowMs: number,
  lastAttemptMs: number | null,
  hour: number = CHECK_HOUR,
): number => {
  const today = todayAt(nowMs, hour);
  const mostRecent = today <= nowMs ? today : todayAt(nowMs - 24 * HOUR_MS, hour);
  if (lastAttemptMs === null || lastAttemptMs < mostRecent) return STARTUP_CHECK_DELAY_MS;
  const next = today > nowMs ? today : todayAt(nowMs + 24 * HOUR_MS, hour);
  return next - nowMs;
};
