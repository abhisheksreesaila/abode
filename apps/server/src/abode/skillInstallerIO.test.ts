// @effect-diagnostics nodeBuiltinImport:off - the installer writes into a real temp HOME.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { makeInstall, type SkillInstallRequest } from "./skillInstallerIO.ts";
import { folderHash, gitBlobSha, type SnapshotSkill } from "./skillSourcesCore.ts";
import { SkillSourceFetchError, localSkillsFor } from "./skillSourcesIO.ts";

const enc = (text: string) => new TextEncoder().encode(text);

const REPO = "mattpocock/skills";

const skillOf = (
  key: string,
  name: string,
  files: Record<string, string>,
  knownHashes: string[] = [],
): SnapshotSkill => {
  const hash = folderHash(
    Object.entries(files).map(([path, text]) => ({ path, sha: gitBlobSha(enc(text)) })),
  );
  return {
    key,
    name,
    description: "d",
    tokens: 10,
    hash,
    files: Object.keys(files),
    knownHashes: [...knownHashes, hash],
  };
};

const setup = (upstream: Record<string, string>) => {
  const home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "installer-"));
  const claude = NodePath.join(home, ".claude", "skills");
  const agents = NodePath.join(home, ".agents", "skills");
  NodeFS.mkdirSync(claude, { recursive: true });
  NodeFS.mkdirSync(agents, { recursive: true });
  const dirs = [claude, agents];
  const fetched: string[] = [];
  const install = makeInstall({
    fetcher: {
      tree: () => Effect.succeed([]),
      npmVersion: () => Effect.succeed("1"),
      file: (_repo, path) => {
        fetched.push(path);
        const text = upstream[path];
        return text === undefined
          ? Effect.fail(new SkillSourceFetchError({ reason: `${path}: HTTP 404` }))
          : Effect.succeed(text);
      },
    },
    local: localSkillsFor(dirs),
    dirs,
    defaultDir: claude,
  });
  const read = (...parts: string[]) => NodeFS.readFileSync(NodePath.join(home, ...parts), "utf8");
  return { home, claude, agents, install, fetched, read };
};

const request = (changes: SkillInstallRequest["changes"]): SkillInstallRequest => ({
  source: { name: "Matt Pocock", repo: REPO },
  changes,
});

describe("skill installer", () => {
  it.effect(
    "installs only the chosen new skill into ~/.claude/skills, with its nested files",
    () => {
      const upstream = {
        "skills/tdd/SKILL.md": "tdd v1",
        "skills/tdd/refs/a.md": "ref a",
        "skills/pr/SKILL.md": "pr v1",
      };
      const world = setup(upstream);
      const tdd = skillOf("skills/tdd", "tdd", { "SKILL.md": "tdd v1", "refs/a.md": "ref a" });
      return Effect.gen(function* () {
        yield* world.install(
          request([{ kind: "new", key: "skills/tdd", name: "tdd", skill: tdd }]),
        );
        expect(world.read(".claude", "skills", "tdd", "SKILL.md")).toBe("tdd v1");
        expect(world.read(".claude", "skills", "tdd", "refs", "a.md")).toBe("ref a");
        expect(NodeFS.existsSync(NodePath.join(world.claude, "pr"))).toBe(false);
        expect(NodeFS.readdirSync(world.claude)).toEqual(["tdd"]);
      });
    },
  );

  it.effect("updates an installed skill through its symlink, in the real folder", () => {
    const world = setup({ "skills/tdd/SKILL.md": "tdd v2" });
    const real = NodePath.join(world.agents, "tdd");
    NodeFS.mkdirSync(real);
    NodeFS.writeFileSync(NodePath.join(real, "SKILL.md"), "tdd v1");
    NodeFS.writeFileSync(NodePath.join(real, "generated.txt"), "keep me");
    NodeFS.symlinkSync(real, NodePath.join(world.claude, "tdd"));
    const v2 = skillOf("skills/tdd", "tdd", { "SKILL.md": "tdd v2" }, [
      folderHash([{ path: "SKILL.md", sha: gitBlobSha(enc("tdd v1")) }]),
    ]);
    return Effect.gen(function* () {
      yield* world.install(
        request([{ kind: "updated", key: "skills/tdd", name: "tdd", skill: v2 }]),
      );
      expect(world.read(".agents", "skills", "tdd", "SKILL.md")).toBe("tdd v2");
      expect(world.read(".agents", "skills", "tdd", "generated.txt")).toBe("keep me");
      expect(NodeFS.lstatSync(NodePath.join(world.claude, "tdd")).isSymbolicLink()).toBe(true);
      expect(NodeFS.readdirSync(world.agents)).toEqual(["tdd"]);
    });
  });

  it.effect("refuses an edited skill and leaves it byte for byte", () => {
    const world = setup({ "skills/tdd/SKILL.md": "tdd v2" });
    const folder = NodePath.join(world.claude, "tdd");
    NodeFS.mkdirSync(folder);
    NodeFS.writeFileSync(NodePath.join(folder, "SKILL.md"), "my own edit");
    const v2 = skillOf("skills/tdd", "tdd", { "SKILL.md": "tdd v2" });
    return Effect.gen(function* () {
      const error = yield* world
        .install(request([{ kind: "updated", key: "skills/tdd", name: "tdd", skill: v2 }]))
        .pipe(Effect.flip);
      expect(error.failure).toBe("local_edited");
      expect(world.read(".claude", "skills", "tdd", "SKILL.md")).toBe("my own edit");
    });
  });

  it.effect("never deletes a skill that was removed upstream", () => {
    const world = setup({});
    const folder = NodePath.join(world.claude, "wizard");
    NodeFS.mkdirSync(folder);
    NodeFS.writeFileSync(NodePath.join(folder, "SKILL.md"), "wizard");
    const gone = skillOf("skills/wizard", "wizard", { "SKILL.md": "wizard" });
    return Effect.gen(function* () {
      yield* world.install(
        request([{ kind: "removed", key: "skills/wizard", name: "wizard", skill: gone }]),
      );
      expect(world.read(".claude", "skills", "wizard", "SKILL.md")).toBe("wizard");
      expect(world.fetched).toEqual([]);
    });
  });

  it.effect("writes nothing when a file cannot be fetched or upstream moved on", () => {
    const world = setup({ "skills/a/SKILL.md": "changed since the check" });
    const a = skillOf("skills/a", "a", { "SKILL.md": "as checked" });
    const b = skillOf("skills/b", "b", { "SKILL.md": "b" });
    return Effect.gen(function* () {
      const moved = yield* world
        .install(request([{ kind: "new", key: "skills/a", name: "a", skill: a }]))
        .pipe(Effect.flip);
      expect(moved.message).toBe(
        "'a' changed upstream since the last check (or has binary files); check again.",
      );
      const missing = yield* world
        .install(request([{ kind: "new", key: "skills/b", name: "b", skill: b }]))
        .pipe(Effect.flip);
      expect(missing.message).toBe("skills/b/SKILL.md: HTTP 404");
      expect(NodeFS.readdirSync(world.claude)).toEqual([]);
    });
  });

  it.effect("never writes through a symlinked SKILL.md or subfolder", () => {
    const world = setup({ "skills/tdd/SKILL.md": "tdd v2", "skills/tdd/refs/a.md": "ref v2" });
    const outside = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "outside-"));
    NodeFS.writeFileSync(NodePath.join(outside, "secret.md"), "outside file");
    NodeFS.mkdirSync(NodePath.join(outside, "refs"));
    NodeFS.writeFileSync(NodePath.join(outside, "refs", "a.md"), "outside ref");
    const folder = NodePath.join(world.claude, "tdd");
    NodeFS.mkdirSync(folder);
    NodeFS.symlinkSync(NodePath.join(outside, "secret.md"), NodePath.join(folder, "SKILL.md"));
    NodeFS.symlinkSync(NodePath.join(outside, "refs"), NodePath.join(folder, "refs"));
    const v2 = skillOf("skills/tdd", "tdd", { "SKILL.md": "tdd v2", "refs/a.md": "ref v2" }, [
      folderHash([
        { path: "SKILL.md", sha: gitBlobSha(enc("outside file")) },
        { path: "refs/a.md", sha: gitBlobSha(enc("outside ref")) },
      ]),
    ]);
    return Effect.gen(function* () {
      yield* world.install(
        request([{ kind: "updated", key: "skills/tdd", name: "tdd", skill: v2 }]),
      );
      expect(world.read(".claude", "skills", "tdd", "SKILL.md")).toBe("tdd v2");
      expect(world.read(".claude", "skills", "tdd", "refs", "a.md")).toBe("ref v2");
      expect(NodeFS.lstatSync(NodePath.join(folder, "SKILL.md")).isSymbolicLink()).toBe(false);
      expect(NodeFS.lstatSync(NodePath.join(folder, "refs")).isSymbolicLink()).toBe(false);
      expect(NodeFS.readFileSync(NodePath.join(outside, "secret.md"), "utf8")).toBe("outside file");
      expect(NodeFS.readFileSync(NodePath.join(outside, "refs", "a.md"), "utf8")).toBe(
        "outside ref",
      );
    });
  });

  it.effect("refuses a skill that lives outside the skill folders", () => {
    const world = setup({ "skills/tdd/SKILL.md": "tdd v2" });
    const outside = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "outside-"));
    NodeFS.writeFileSync(NodePath.join(outside, "SKILL.md"), "tdd v1");
    NodeFS.symlinkSync(outside, NodePath.join(world.claude, "tdd"));
    const v2 = skillOf("skills/tdd", "tdd", { "SKILL.md": "tdd v2" }, [
      folderHash([{ path: "SKILL.md", sha: gitBlobSha(enc("tdd v1")) }]),
    ]);
    return Effect.gen(function* () {
      const error = yield* world
        .install(request([{ kind: "updated", key: "skills/tdd", name: "tdd", skill: v2 }]))
        .pipe(Effect.flip);
      expect(error.message).toBe(
        `tdd lives outside your skill folders (${NodeFS.realpathSync(outside)}); not updated`,
      );
      expect(NodeFS.readFileSync(NodePath.join(outside, "SKILL.md"), "utf8")).toBe("tdd v1");
    });
  });

  it.effect("writes every real copy of a skill held in two roots", () => {
    const world = setup({ "skills/tdd/SKILL.md": "tdd v2" });
    for (const root of [world.claude, world.agents]) {
      NodeFS.mkdirSync(NodePath.join(root, "tdd"));
      NodeFS.writeFileSync(NodePath.join(root, "tdd", "SKILL.md"), "tdd v1");
    }
    const v2 = skillOf("skills/tdd", "tdd", { "SKILL.md": "tdd v2" }, [
      folderHash([{ path: "SKILL.md", sha: gitBlobSha(enc("tdd v1")) }]),
    ]);
    return Effect.gen(function* () {
      yield* world.install(
        request([{ kind: "updated", key: "skills/tdd", name: "tdd", skill: v2 }]),
      );
      expect(world.read(".claude", "skills", "tdd", "SKILL.md")).toBe("tdd v2");
      expect(world.read(".agents", "skills", "tdd", "SKILL.md")).toBe("tdd v2");
    });
  });

  it.effect("refuses names that could escape the skill folder", () => {
    const world = setup({ "x/SKILL.md": "x" });
    return Effect.gen(function* () {
      for (const name of ["", "../evil", ".hidden", "a\\b"]) {
        const skill = skillOf("x", name || "x", { "SKILL.md": "x" });
        const error = yield* world
          .install(request([{ kind: "new", key: "x", name, skill }]))
          .pipe(Effect.flip);
        expect(error.message).toBe(`'${name}' is not a usable skill name.`);
      }
      expect(NodeFS.readdirSync(world.claude)).toEqual([]);
    });
  });

  it.effect("installs a repo-root skill from the repo root", () => {
    const world = setup({ "SKILL.md": "root skill", "extra.md": "x" });
    const root = skillOf(".", "gstack", { "SKILL.md": "root skill", "extra.md": "x" });
    return Effect.gen(function* () {
      yield* world.install(request([{ kind: "new", key: ".", name: "gstack", skill: root }]));
      expect(world.read(".claude", "skills", "gstack", "extra.md")).toBe("x");
    });
  });
});
