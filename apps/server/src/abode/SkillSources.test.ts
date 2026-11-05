// @effect-diagnostics nodeBuiltinImport:off - the state file lives in a real temp directory.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "@effect/vitest";
import type { SkillSourceStatus } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { TestClock } from "effect/testing";

import * as SkillSources from "./SkillSources.ts";
import { folderHash, gitBlobSha } from "./skillSourcesCore.ts";
import {
  LocalSkills,
  SkillSourceFetchError,
  SkillSourceFetcher,
  localSkillHashes,
} from "./skillSourcesIO.ts";

const enc = (text: string) => new TextEncoder().encode(text);

const skillMd = (name: string, description: string, body = "") =>
  `---\nname: ${name}\ndescription: ${description}\n---\n${body}`;

/** The fake GitHub: `repos[repo][path] = content`; a repo set to an Error fails its tree call. */
class FakeWorld {
  repos: Record<string, Record<string, string> | Error> = {};
  npm: Record<string, string> = {};
  treeCalls = 0;
  fileCalls: string[] = [];
  /** Installed folders by skill name: file path -> contents. */
  installed: Record<string, Record<string, string>> = {};
  installs: Array<ReadonlyArray<string>> = [];

  fetcher = SkillSourceFetcher.of({
    tree: (repo) => {
      this.treeCalls += 1;
      const files = this.repos[repo];
      if (files === undefined || files instanceof Error) {
        return Effect.fail(
          new SkillSourceFetchError({ reason: files?.message ?? `github ${repo}: HTTP 404` }),
        );
      }
      return Effect.succeed(
        Object.entries(files).map(([path, content]) => ({
          path,
          type: "blob" as const,
          sha: gitBlobSha(enc(content)),
        })),
      );
    },
    file: (repo, path) => {
      this.fileCalls.push(`${repo}/${path}`);
      const files = this.repos[repo];
      const content = files instanceof Error ? undefined : files?.[path];
      return content === undefined
        ? Effect.fail(new SkillSourceFetchError({ reason: `${path}: HTTP 404` }))
        : Effect.succeed(content);
    },
    npmVersion: (pkg) =>
      this.npm[pkg] === undefined
        ? Effect.fail(new SkillSourceFetchError({ reason: `npm ${pkg}: HTTP 500` }))
        : Effect.succeed(this.npm[pkg]),
  });

  local = LocalSkills.of({
    hashesFor: (name, files) => {
      const installed = this.installed[name];
      if (installed === undefined) return Effect.succeed([]);
      return Effect.succeed([
        folderHash(
          files.flatMap((path) =>
            installed[path] === undefined ? [] : [{ path, sha: gitBlobSha(enc(installed[path])) }],
          ),
        ),
      ]);
    },
  });

  installer = SkillSources.SkillInstaller.of({
    install: ({ changes }) =>
      Effect.sync(() => {
        this.installs.push(changes.map((change) => `${change.kind}:${change.name}`));
      }),
  });

  layer = (stateFile: string) =>
    SkillSources.layerWith(stateFile).pipe(
      Layer.provide(Layer.succeed(SkillSources.SkillInstaller, this.installer)),
      Layer.provide(Layer.succeed(LocalSkills, this.local)),
      Layer.provide(Layer.succeed(SkillSourceFetcher, this.fetcher)),
    );
}

const tempStateFile = () =>
  NodePath.join(NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "skill-sources-")), "state.json");

const MATT = "mattpocock/skills";

const mattV1 = (): Record<string, string> => ({
  "skills/tdd/SKILL.md": skillMd("tdd", "Test-driven development loop."),
  "skills/pr/SKILL.md": skillMd("pr", "Write a PR body."),
  "skills/wizard/SKILL.md": skillMd("wizard", "Interactive bash wizard."),
  "README.md": "readme",
});

const matt = (sources: ReadonlyArray<SkillSourceStatus>) => {
  const found = sources.find((source) => source.id === "matt");
  if (found === undefined) throw new Error("matt source missing");
  return found;
};

const summary = (source: SkillSourceStatus) =>
  source.changes.map((change) => `${change.kind}:${change.name}:${change.local}`);

describe("SkillSources", () => {
  it.effect("starts from the first look, then reports new, updated and removed skills", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    world.installed = {
      tdd: { "SKILL.md": mattV1()["skills/tdd/SKILL.md"] ?? "" },
      wizard: { "SKILL.md": mattV1()["skills/wizard/SKILL.md"] ?? "" },
    };
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      const first = matt((yield* service.checkNow).sources);
      expect(first.changes).toEqual([]);
      expect(first.skillCount).toBe(3);
      expect(first.npm).toEqual({ package: "skills", latest: "1.0.0", seen: "1.0.0" });

      world.repos[MATT] = {
        ...mattV1(),
        "skills/tdd/SKILL.md": skillMd("tdd", "Test-driven development, now with spies."),
        "skills/grill-me/SKILL.md": skillMd("grill-me", "Interview the plan until it holds."),
      };
      delete (world.repos[MATT] as Record<string, string>)["skills/wizard/SKILL.md"];
      world.npm.skills = "1.1.0";
      const second = matt((yield* service.checkNow).sources);

      expect(second.changes).toEqual([
        {
          kind: "new",
          key: "skills/grill-me",
          name: "grill-me",
          description: "Interview the plan until it holds.",
          tokens:
            20 + Math.ceil(("grill-me".length + "Interview the plan until it holds.".length) / 4),
          local: "none",
        },
        {
          kind: "updated",
          key: "skills/tdd",
          name: "tdd",
          description: "Test-driven development, now with spies.",
          tokens:
            20 + Math.ceil(("tdd".length + "Test-driven development, now with spies.".length) / 4),
          local: "outdated",
        },
        {
          kind: "removed",
          key: "skills/wizard",
          name: "wizard",
          description: "Interactive bash wizard.",
          tokens: 20 + Math.ceil(("wizard".length + "Interactive bash wizard.".length) / 4),
          local: "same",
        },
      ]);
      expect(second.npm).toEqual({ package: "skills", latest: "1.1.0", seen: "1.0.0" });
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect("fetches SKILL.md only for skills whose folder changed", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      yield* service.checkNow;
      world.fileCalls.length = 0;
      world.repos[MATT] = {
        ...mattV1(),
        "skills/pr/SKILL.md": skillMd("pr", "Write a PR body, shorter."),
      };
      yield* service.checkNow;
      expect(world.fileCalls.filter((call) => call.startsWith(MATT))).toEqual([
        `${MATT}/skills/pr/SKILL.md`,
      ]);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect(
    "says an update is edited locally only when the installed copy matches no upstream version",
    () => {
      const world = new FakeWorld();
      const v1 = mattV1();
      world.repos[MATT] = v1;
      world.npm.skills = "1.0.0";
      world.installed = {
        tdd: { "SKILL.md": v1["skills/tdd/SKILL.md"] ?? "" },
        pr: { "SKILL.md": `${v1["skills/pr/SKILL.md"]}\nmy own rule` },
      };
      return Effect.gen(function* () {
        const service = yield* SkillSources.SkillSources;
        yield* service.checkNow;
        world.repos[MATT] = {
          ...v1,
          "skills/tdd/SKILL.md": skillMd("tdd", "Test-driven development v2."),
          "skills/pr/SKILL.md": skillMd("pr", "Write a PR body v2."),
          "skills/zoom-out/SKILL.md": skillMd("zoom-out", "Zoom out."),
        };
        const after = matt((yield* service.checkNow).sources);
        expect(summary(after)).toEqual([
          "new:zoom-out:none",
          "updated:pr:edited",
          "updated:tdd:outdated",
        ]);
      }).pipe(Effect.provide(world.layer(tempStateFile())));
    },
  );

  it.effect(
    "keeps the last result and reports 'check failed' with the time when the network fails",
    () => {
      const world = new FakeWorld();
      world.repos[MATT] = mattV1();
      world.npm.skills = "1.0.0";
      return Effect.gen(function* () {
        const service = yield* SkillSources.SkillSources;
        yield* service.checkNow;
        world.repos[MATT] = { ...mattV1(), "skills/new/SKILL.md": skillMd("new", "Fresh.") };
        yield* service.checkNow;
        yield* TestClock.adjust("2 hours");
        world.repos[MATT] = new Error("github mattpocock/skills: rate limited, resets later");
        const failedCheck = matt((yield* service.checkNow).sources);

        expect(failedCheck.failure).toBe(
          "check failed: github mattpocock/skills: rate limited, resets later",
        );
        expect(failedCheck.lastCheckedAt).toBe("1970-01-01T02:00:00.000Z");
        // The startup check ran 30 seconds in; the manual one after two hours is the one that failed.
        expect(failedCheck.lastOkAt).toBe("1970-01-01T00:00:30.000Z");
        expect(summary(failedCheck)).toEqual(["new:new:none"]);
        expect(failedCheck.skillCount).toBe(4);

        world.repos[MATT] = { ...mattV1(), "skills/new/SKILL.md": skillMd("new", "Fresh.") };
        const recovered = matt((yield* service.checkNow).sources);
        expect(recovered.failure).toBeUndefined();
        expect(recovered.lastOkAt).toBe("1970-01-01T02:00:00.000Z");
      }).pipe(Effect.provide(world.layer(tempStateFile())));
    },
  );

  it.effect("fails the check when the repo shows no skills, instead of removing them all", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      yield* service.checkNow;
      world.repos[MATT] = { "README.md": "moved" };
      const after = matt((yield* service.checkNow).sources);
      expect(after.failure).toContain("no skills found");
      expect(after.changes).toEqual([]);
      expect(after.skillCount).toBe(3);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect("lists the four sources, pstack from the cursor/plugins repo", () => {
    const world = new FakeWorld();
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      const state = yield* service.list;
      expect(state.sources.map((source) => [source.id, source.supported])).toEqual([
        ["matt", true],
        ["gstack", true],
        ["pstack", true],
        ["tstack", true],
      ]);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect(
    "take all updates only installed, unedited skills; new skills are chosen one by one",
    () => {
      const world = new FakeWorld();
      const v1 = mattV1();
      world.repos[MATT] = v1;
      world.npm.skills = "1.0.0";
      world.installed = {
        tdd: { "SKILL.md": v1["skills/tdd/SKILL.md"] ?? "" },
        pr: { "SKILL.md": "my own pr skill" },
        wizard: { "SKILL.md": v1["skills/wizard/SKILL.md"] ?? "" },
      };
      return Effect.gen(function* () {
        const service = yield* SkillSources.SkillSources;
        yield* service.checkNow;
        const next = { ...v1 } as Record<string, string>;
        next["skills/tdd/SKILL.md"] = skillMd("tdd", "TDD v2.");
        next["skills/pr/SKILL.md"] = skillMd("pr", "PR v2.");
        next["skills/zoom-out/SKILL.md"] = skillMd("zoom-out", "Zoom out.");
        delete next["skills/wizard/SKILL.md"];
        world.repos[MATT] = next;
        world.npm.skills = "1.2.0";
        const before = matt((yield* service.checkNow).sources);
        expect(summary(before)).toEqual([
          "new:zoom-out:none",
          "updated:pr:edited",
          "updated:tdd:outdated",
          "removed:wizard:same",
        ]);

        const all = matt(
          (yield* service.decide({ sourceId: "matt", decision: "takeAll" })).sources,
        );
        expect(world.installs).toEqual([["updated:tdd", "removed:wizard"]]);
        expect(summary(all)).toEqual(["new:zoom-out:none", "updated:pr:edited"]);
        // Two changes are still waiting, so the npm release is not accepted yet.
        expect(all.npm?.seen).toBe("1.0.0");
        expect(all.decisions.map((d) => [d.name, d.takeAll])).toEqual([
          ["tdd", true],
          ["wizard", true],
        ]);
      }).pipe(Effect.provide(world.layer(tempStateFile())));
    },
  );

  it.effect("accepts the npm release once nothing is left to decide", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      yield* service.checkNow;
      world.repos[MATT] = { ...mattV1(), "skills/zoom-out/SKILL.md": skillMd("zoom-out", "Zoom.") };
      world.npm.skills = "1.1.0";
      yield* service.checkNow;
      const done = matt(
        (yield* service.decide({ sourceId: "matt", decision: "inherit", key: "skills/zoom-out" }))
          .sources,
      );
      expect(world.installs).toEqual([["new:zoom-out"]]);
      expect(done.changes).toEqual([]);
      expect(done.npm?.seen).toBe("1.1.0");
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect("refuses to inherit over an edited skill, but lets it be skipped", () => {
    const world = new FakeWorld();
    const v1 = mattV1();
    world.repos[MATT] = v1;
    world.npm.skills = "1.0.0";
    world.installed = { pr: { "SKILL.md": "my own pr skill" } };
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      yield* service.checkNow;
      world.repos[MATT] = { ...v1, "skills/pr/SKILL.md": skillMd("pr", "PR v2.") };
      yield* service.checkNow;
      const refused = yield* service
        .decide({ sourceId: "matt", decision: "inherit", key: "skills/pr" })
        .pipe(Effect.flip);
      expect(refused.failure).toBe("local_edited");
      expect(world.installs).toEqual([]);
      const skipped = matt(
        (yield* service.decide({ sourceId: "matt", decision: "skip", key: "skills/pr" })).sources,
      );
      expect(skipped.changes).toEqual([]);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect("a skipped skill never comes back, even when upstream changes it again", () => {
    const world = new FakeWorld();
    const v1 = mattV1();
    world.repos[MATT] = v1;
    world.npm.skills = "1.0.0";
    world.installed = { zoomed: { "SKILL.md": "x" } };
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      yield* service.checkNow;
      world.repos[MATT] = { ...v1, "skills/zoom-out/SKILL.md": skillMd("zoom-out", "Zoom out.") };
      yield* service.checkNow;
      const skipped = matt(
        (yield* service.decide({ sourceId: "matt", decision: "skip", key: "skills/zoom-out" }))
          .sources,
      );
      expect(skipped.changes).toEqual([]);
      expect(skipped.decisions.map((d) => [d.name, d.decision])).toEqual([["zoom-out", "skip"]]);

      world.installed = { "zoom-out": { "SKILL.md": skillMd("zoom-out", "Zoom out.") } };
      world.repos[MATT] = { ...v1, "skills/zoom-out/SKILL.md": skillMd("zoom-out", "Zoom v2.") };
      expect(matt((yield* service.checkNow).sources).changes).toEqual([]);
      world.repos[MATT] = { ...v1 };
      expect(matt((yield* service.checkNow).sources).changes).toEqual([]);
      world.repos[MATT] = { ...v1, "skills/zoom-out/SKILL.md": skillMd("zoom-out", "Zoom v3.") };
      expect(matt((yield* service.checkNow).sources).changes).toEqual([]);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect(
    "an update to a skill the person does not have is accepted quietly, not offered",
    () => {
      const world = new FakeWorld();
      const v1 = mattV1();
      world.repos[MATT] = v1;
      world.npm.skills = "1.0.0";
      return Effect.gen(function* () {
        const service = yield* SkillSources.SkillSources;
        yield* service.checkNow;
        world.repos[MATT] = {
          ...v1,
          "skills/tdd/SKILL.md": skillMd("tdd", "TDD v2."),
          "skills/zoom-out/SKILL.md": skillMd("zoom-out", "Zoom out."),
        };
        expect(summary(matt((yield* service.checkNow).sources))).toEqual(["new:zoom-out:none"]);
        // Installing tdd later and changing it upstream again offers the update.
        world.installed = { tdd: { "SKILL.md": skillMd("tdd", "TDD v2.") } };
        world.repos[MATT] = {
          ...world.repos[MATT],
          "skills/tdd/SKILL.md": skillMd("tdd", "TDD v3."),
        } as Record<string, string>;
        expect(summary(matt((yield* service.checkNow).sources))).toEqual([
          "new:zoom-out:none",
          "updated:tdd:outdated",
        ]);
      }).pipe(Effect.provide(world.layer(tempStateFile())));
    },
  );

  it.effect("refuses to decide on a skill with no pending change, and records nothing", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      yield* service.checkNow;
      const unknown = yield* service
        .decide({ sourceId: "matt", decision: "inherit", key: "skills/tdd" })
        .pipe(Effect.flip);
      expect(unknown.failure).toBe("unknown_change");
      const noKey = yield* service.decide({ sourceId: "matt", decision: "skip" }).pipe(Effect.flip);
      expect(noKey.failure).toBe("key_required");
      const noSource = yield* service
        .decide({ sourceId: "nope", decision: "takeAll" })
        .pipe(Effect.flip);
      expect(noSource.failure).toBe("unknown_source");
      expect(world.installs).toEqual([]);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });

  it.effect("keeps its state across restarts", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    const stateFile = tempStateFile();
    return Effect.gen(function* () {
      yield* Effect.gen(function* () {
        const service = yield* SkillSources.SkillSources;
        yield* service.checkNow;
        world.repos[MATT] = { ...mattV1(), "skills/new/SKILL.md": skillMd("new", "Fresh.") };
        yield* service.checkNow;
        yield* service.decide({ sourceId: "matt", decision: "skip", key: "skills/new" });
      }).pipe(Effect.provide(world.layer(stateFile)), Effect.scoped);
      const reopened = yield* Effect.gen(function* () {
        return matt((yield* (yield* SkillSources.SkillSources).list).sources);
      }).pipe(Effect.provide(world.layer(stateFile)));
      expect(reopened.skillCount).toBe(4);
      expect(reopened.changes).toEqual([]);
      expect(reopened.decisions.map((d) => d.name)).toEqual(["new"]);
    });
  });

  it.effect("runs a first check shortly after start without anyone asking", () => {
    const world = new FakeWorld();
    world.repos[MATT] = mattV1();
    world.npm.skills = "1.0.0";
    return Effect.gen(function* () {
      const service = yield* SkillSources.SkillSources;
      expect(matt((yield* service.list).sources).lastCheckedAt).toBeUndefined();
      yield* TestClock.adjust("31 seconds");
      yield* Effect.yieldNow;
      expect(matt((yield* service.list).sources).skillCount).toBe(3);
    }).pipe(Effect.provide(world.layer(tempStateFile())));
  });
});

describe("localSkillHashes", () => {
  it("follows symlinks and ignores files upstream does not have", async () => {
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "skill-local-"));
    const agents = NodePath.join(root, "agents");
    const claude = NodePath.join(root, "claude");
    NodeFS.mkdirSync(NodePath.join(agents, "tdd"), { recursive: true });
    NodeFS.mkdirSync(claude);
    NodeFS.writeFileSync(NodePath.join(agents, "tdd", "SKILL.md"), "body");
    NodeFS.writeFileSync(NodePath.join(agents, "tdd", "generated.json"), "{}");
    NodeFS.symlinkSync(NodePath.join(agents, "tdd"), NodePath.join(claude, "tdd"));

    const expected = folderHash([{ path: "SKILL.md", sha: gitBlobSha(enc("body")) }]);
    expect(
      await localSkillHashes([claude, agents, NodePath.join(root, "codex")], "tdd", ["SKILL.md"]),
    ).toEqual([expected, expected]);
    expect(await localSkillHashes([claude], "missing", ["SKILL.md"])).toEqual([]);
  });
});
