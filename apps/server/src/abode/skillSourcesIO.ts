// @effect-diagnostics nodeBuiltinImport:off globalFetchInEffect:off globalDateInEffect:off instanceOfSchema:off - symlink-following stats are not in FileSystem; plain fetch needs no HttpClient layer in the server, and a rate-limit reset is shown as a time.
/**
 * The two edges of the skill-source check: GitHub and npm over HTTPS (no auth; a rate limit is
 * reported, not worked around), and the installed skill folders on disk.
 */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { skillRootDirs } from "./skillRoots.ts";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { folderHash, gitBlobSha, type FolderFile, type TreeEntry } from "./skillSourcesCore.ts";

export class SkillSourceFetchError extends Schema.TaggedError<SkillSourceFetchError>()(
  "SkillSourceFetchError",
  { reason: Schema.String },
) {
  override get message(): string {
    return this.reason;
  }
}

export interface SkillSourceFetcherShape {
  /** Every file in the repo's default branch. */
  readonly tree: (repo: string) => Effect.Effect<ReadonlyArray<TreeEntry>, SkillSourceFetchError>;
  readonly file: (repo: string, path: string) => Effect.Effect<string, SkillSourceFetchError>;
  readonly npmVersion: (pkg: string) => Effect.Effect<string, SkillSourceFetchError>;
}

export class SkillSourceFetcher extends Context.Service<
  SkillSourceFetcher,
  SkillSourceFetcherShape
>()("t3/abode/skillSourcesIO/SkillSourceFetcher") {}

const REQUEST_TIMEOUT_MS = 20_000;

const request = (url: string, what: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: { "user-agent": "abode-skill-check", accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 403 || response.status === 429) {
        const reset = Number(response.headers.get("x-ratelimit-reset"));
        const when =
          Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : "";
        throw new SkillSourceFetchError({
          reason: `${what}: rate limited${when ? `, resets ${when}` : ""}`,
        });
      }
      if (!response.ok) {
        throw new SkillSourceFetchError({ reason: `${what}: HTTP ${response.status}` });
      }
      return response;
    },
    catch: (cause) =>
      cause instanceof SkillSourceFetchError
        ? cause
        : new SkillSourceFetchError({
            reason: `${what}: ${cause instanceof Error ? cause.message : String(cause)}`,
          }),
  });

const json = (response: Response, what: string) =>
  Effect.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: () => new SkillSourceFetchError({ reason: `${what}: unreadable answer` }),
  });

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** One tree call per repo and raw file reads for what changed; raw.githubusercontent.com has no API limit. */
export const fetcherLive: SkillSourceFetcherShape = {
  tree: Effect.fn("SkillSources.fetchTree")(function* (repo) {
    const what = `github ${repo}`;
    const body = yield* request(
      `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
      what,
    ).pipe(Effect.flatMap((response) => json(response, what)));
    const data = body as { tree?: unknown; truncated?: unknown };
    if (!Array.isArray(data.tree) || data.truncated === true) {
      return yield* new SkillSourceFetchError({ reason: `${what}: tree too large or unreadable` });
    }
    return data.tree.flatMap((raw: Record<string, unknown>): TreeEntry[] =>
      typeof raw.path === "string" &&
      typeof raw.sha === "string" &&
      (raw.type === "blob" || raw.type === "tree")
        ? [{ path: raw.path, sha: raw.sha, type: raw.type }]
        : [],
    );
  }),
  file: Effect.fn("SkillSources.fetchFile")(function* (repo, path) {
    const what = `github ${repo}/${path}`;
    const response = yield* request(
      `https://raw.githubusercontent.com/${repo}/HEAD/${encodePath(path)}`,
      what,
    );
    return yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => new SkillSourceFetchError({ reason: `${what}: unreadable answer` }),
    });
  }),
  npmVersion: Effect.fn("SkillSources.fetchNpmVersion")(function* (pkg) {
    const what = `npm ${pkg}`;
    const body = yield* request(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`,
      what,
    ).pipe(Effect.flatMap((response) => json(response, what)));
    const version = (body as { version?: unknown }).version;
    return typeof version === "string" && version !== ""
      ? version
      : yield* new SkillSourceFetchError({ reason: `${what}: no version` });
  }),
};

/** The person's installed copies of a skill: one hash per installed folder. */
export interface LocalSkillsShape {
  readonly hashesFor: (
    name: string,
    files: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<string>>;
}

export class LocalSkills extends Context.Service<LocalSkills, LocalSkillsShape>()(
  "t3/abode/skillSourcesIO/LocalSkills",
) {}

const sha = async (path: string): Promise<string | null> => {
  try {
    if (!(await NodeFSP.stat(path)).isFile()) return null;
    return gitBlobSha(await NodeFSP.readFile(path));
  } catch {
    return null;
  }
};

/**
 * Hash of the installed folders called `name`, over the files upstream has in the skill (so extra
 * files an installer generates do not count as an edit). Symlinks are followed: most installs are
 * links. A folder without its SKILL.md is not an install.
 */
export const localSkillHashes = async (
  dirs: ReadonlyArray<string>,
  name: string,
  files: ReadonlyArray<string>,
): Promise<string[]> => {
  const hashes: string[] = [];
  for (const dir of dirs) {
    const folder = NodePath.join(dir, name);
    if ((await sha(NodePath.join(folder, "SKILL.md"))) === null) continue;
    const present: FolderFile[] = [];
    for (const file of files) {
      const hash = await sha(NodePath.join(folder, file));
      if (hash !== null) present.push({ path: file, sha: hash });
    }
    hashes.push(folderHash(present));
  }
  return hashes;
};

export const defaultLocalSkillDirs = (): string[] => skillRootDirs();

export const localSkillsFor = (dirs: ReadonlyArray<string>): LocalSkillsShape => ({
  hashesFor: (name, files) => Effect.promise(() => localSkillHashes(dirs, name, files)),
});
