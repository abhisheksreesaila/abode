// @effect-diagnostics nodeBuiltinImport:off - symlinks and process.env are not in FileSystem.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { symlinksSupported } from "@t3tools/shared/testing/symlinks";

import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import * as Customizations from "./Customizations.ts";

const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const registeredRoots = new Set<string>();

const FakeProjectionSnapshotQuery = Layer.succeed(ProjectionSnapshotQuery.ProjectionSnapshotQuery, {
  getActiveProjectByWorkspaceRoot: (workspaceRoot: string) =>
    Effect.succeed(
      registeredRoots.has(workspaceRoot)
        ? Option.some({ workspaceRoot } as never)
        : Option.none<never>(),
    ),
} as unknown as ProjectionSnapshotQuery.ProjectionSnapshotQueryShape);

const TestLayer = Customizations.layer.pipe(
  Layer.provideMerge(FakeProjectionSnapshotQuery),
  Layer.provideMerge(NodeServices.layer),
);

/** A registered workspace and an isolated Claude config dir, restored afterwards. */
const makeSandbox = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "t3code-customizations-" });
  const realRoot = yield* fileSystem.realPath(root);
  const configDir = path.join(realRoot, "claude-home");
  const workspace = path.join(realRoot, "workspace");
  const outside = path.join(realRoot, "outside");
  yield* fileSystem.makeDirectory(configDir, { recursive: true });
  yield* fileSystem.makeDirectory(workspace, { recursive: true });
  yield* fileSystem.makeDirectory(outside, { recursive: true });

  const codexDir = path.join(realRoot, "codex-home");
  yield* fileSystem.makeDirectory(codexDir, { recursive: true });
  const previous = process.env.CLAUDE_CONFIG_DIR;
  const previousCodex = process.env.CODEX_HOME;
  process.env.CLAUDE_CONFIG_DIR = configDir;
  process.env.CODEX_HOME = codexDir;
  registeredRoots.add(workspace);
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      registeredRoots.delete(workspace);
      if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previous;
      if (previousCodex === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodex;
    }),
  );
  return { path, fileSystem, root: realRoot, configDir, codexDir, workspace, outside };
});

const put = (filePath: string, contents: string) =>
  Effect.sync(() => {
    NodeFS.mkdirSync(NodePath.dirname(filePath), { recursive: true });
    NodeFS.writeFileSync(filePath, contents);
  });

const mkdirp = (dir: string) => Effect.sync(() => NodeFS.mkdirSync(dir, { recursive: true }));

describe("Customizations", () => {
  it.effect("lists user and workspace skills, agents, MCP servers and instructions", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, configDir, workspace } = yield* makeSandbox;
      yield* mkdirp(path.join(configDir, "skills", "user-skill"));
      yield* put(
        path.join(configDir, "skills", "user-skill", "SKILL.md"),
        "---\ndescription: from user\n---\nbody",
      );
      yield* mkdirp(path.join(workspace, ".claude", "skills", "ws-skill"));
      yield* put(
        path.join(workspace, ".claude", "skills", "ws-skill", "SKILL.md"),
        "---\ndescription: from workspace\n---\nbody",
      );
      yield* mkdirp(path.join(configDir, "agents"));
      yield* put(
        path.join(configDir, "agents", "reviewer.md"),
        "---\nname: code-reviewer\ndescription: reviews code\n---\nprompt",
      );
      yield* mkdirp(path.join(workspace, ".claude", "agents"));
      yield* put(path.join(workspace, ".claude", "agents", "planner.md"), "no frontmatter");
      yield* put(
        path.join(workspace, ".mcp.json"),
        toJson({ mcpServers: { github: { command: "gh", env: { TOKEN: "s3cret" } } } }),
      );
      yield* put(
        path.join(configDir, ".claude.json"),
        toJson({
          mcpServers: { global: { type: "http", headers: { Authorization: "Bearer topsecret" } } },
          projects: { [workspace]: { mcpServers: { local: { args: ["--key=hunter2"] } } } },
        }),
      );
      yield* put(path.join(configDir, "CLAUDE.md"), "user rules");
      yield* put(path.join(workspace, "CLAUDE.md"), "ws rules");
      yield* put(path.join(workspace, "CLAUDE.local.md"), "local rules");
      yield* mkdirp(path.join(workspace, ".claude"));
      yield* put(path.join(workspace, ".claude", "CLAUDE.md"), "dot rules");

      const { items } = yield* customizations.list({ cwd: workspace });
      const summary = items.map((item) => `${item.kind}:${item.scope}:${item.name}`).sort();
      expect(summary).toEqual(
        [
          "skill:user:user-skill",
          "skill:workspace:ws-skill",
          "agent:user:code-reviewer",
          "agent:workspace:planner",
          "mcp:workspace:github",
          "mcp:user:global",
          "mcp:workspace:local",
          "instructions:user:CLAUDE.md",
          "instructions:workspace:CLAUDE.md",
          "instructions:workspace:CLAUDE.local.md",
          "instructions:workspace:.claude/CLAUDE.md",
        ].sort(),
      );
      expect(items.find((item) => item.name === "code-reviewer")?.description).toBe("reviews code");
      expect(items.find((item) => item.name === "global")).toMatchObject({
        path: path.join(configDir, ".claude.json"),
        readOnly: true,
      });
      expect(items.find((item) => item.name === "github")).toMatchObject({
        path: path.join(workspace, ".mcp.json"),
        readOnly: false,
      });
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("reports the settings.json agent, workspace local over workspace over user", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, configDir, workspace } = yield* makeSandbox;
      expect((yield* customizations.list({ cwd: workspace })).defaultAgent).toBeUndefined();

      yield* put(path.join(configDir, "settings.json"), toJson({ agent: "orchestrator" }));
      expect((yield* customizations.list({ cwd: workspace })).defaultAgent).toBe("orchestrator");

      yield* put(path.join(workspace, ".claude", "settings.json"), toJson({ agent: "reviewer" }));
      expect((yield* customizations.list({ cwd: workspace })).defaultAgent).toBe("reviewer");

      yield* put(
        path.join(workspace, ".claude", "settings.local.json"),
        toJson({ agent: "developer" }),
      );
      expect((yield* customizations.list({ cwd: workspace })).defaultAgent).toBe("developer");

      yield* put(path.join(workspace, ".claude", "settings.local.json"), "{ not json");
      expect((yield* customizations.list({ cwd: workspace })).defaultAgent).toBe("reviewer");
    }).pipe(Effect.provide(TestLayer), Effect.scoped),
  );

  it.effect("never puts MCP env, headers or args in the response", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, configDir, workspace } = yield* makeSandbox;
      yield* put(
        path.join(workspace, ".mcp.json"),
        toJson({
          mcpServers: { github: { command: "gh", env: { TOKEN: "s3cret-env" } } },
        }),
      );
      yield* put(
        path.join(configDir, ".claude.json"),
        toJson({
          mcpServers: { global: { headers: { Authorization: "Bearer topsecret" } } },
          projects: { [workspace]: { mcpServers: { local: { args: ["--key=hunter2"] } } } },
        }),
      );

      const result = yield* customizations.list({ cwd: workspace });
      const wire = toJson(result);
      for (const secret of ["s3cret-env", "topsecret", "hunter2", "Authorization", "TOKEN"]) {
        expect(wire).not.toContain(secret);
      }
      expect(result.items.filter((item) => item.kind === "mcp")).toHaveLength(3);
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("refuses to list a directory that is not a registered project", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { outside } = yield* makeSandbox;
      const error = yield* customizations.list({ cwd: outside }).pipe(Effect.flip);
      expect(error._tag).toBe("CustomizationsCwdNotRegisteredError");
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("saves and reads back through allowed paths", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, fileSystem, configDir, workspace } = yield* makeSandbox;
      const allowed = [
        path.join(workspace, ".claude", "skills", "new", "SKILL.md"),
        path.join(workspace, ".mcp.json"),
        path.join(workspace, "CLAUDE.md"),
        path.join(workspace, "CLAUDE.local.md"),
        path.join(configDir, "agents", "fresh.md"),
        path.join(configDir, "CLAUDE.md"),
      ];
      for (const target of allowed) {
        const written = yield* customizations.writeFile({
          cwd: workspace,
          path: target,
          contents: `hello ${target}`,
        });
        expect(written.byteLength).toBe(Buffer.byteLength(`hello ${target}`));
        expect(yield* fileSystem.readFileString(target)).toBe(`hello ${target}`);
        const read = yield* customizations.readFile({ cwd: workspace, path: target });
        expect(read.contents).toBe(`hello ${target}`);
        expect(read.readOnly).toBe(false);
      }
      // Workspace-relative paths resolve against the project root.
      yield* customizations.writeFile({ cwd: workspace, path: "CLAUDE.md", contents: "rel" });
      expect(yield* fileSystem.readFileString(path.join(workspace, "CLAUDE.md"))).toBe("rel");
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("lists Codex skills, prompts and the workspace AGENTS.md with a codex harness", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, codexDir, workspace } = yield* makeSandbox;
      yield* put(
        path.join(codexDir, "skills", "deploy", "SKILL.md"),
        "---\nname: deploy\ndescription: ships it\n---\nbody",
      );
      yield* put(path.join(codexDir, "skills", ".system", "SKILL.md"), "bundled");
      yield* put(path.join(codexDir, "prompts", "review.md"), "---\ndescription: review\n---\n");
      yield* put(path.join(codexDir, "prompts", "notes.txt"), "ignored");
      yield* put(path.join(workspace, "AGENTS.md"), "rules");
      yield* put(path.join(codexDir, "auth.json"), "{}");

      const { items } = yield* customizations.list({ cwd: workspace });
      const codex = items
        .filter((item) => item.harness === "codex")
        .map((item) => `${item.kind}:${item.scope}:${item.name}`)
        .sort();
      expect(codex).toEqual([
        "agent:user:review",
        "instructions:workspace:AGENTS.md",
        "skill:user:deploy",
      ]);
      expect(items.find((item) => item.name === "deploy")?.description).toBe("ships it");
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("writes Codex skills, prompts and AGENTS.md, expanding ~/.codex and ~/.claude", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, fileSystem, configDir, codexDir, workspace } = yield* makeSandbox;
      const skill = yield* customizations.writeFile({
        cwd: workspace,
        path: "~/.codex/skills/x/SKILL.md",
        contents: "s",
      });
      expect(skill.path).toBe(path.join(codexDir, "skills", "x", "SKILL.md"));
      yield* customizations.writeFile({
        cwd: workspace,
        path: path.join(codexDir, "prompts", "p.md"),
        contents: "p",
      });
      yield* customizations.writeFile({ cwd: workspace, path: "AGENTS.md", contents: "a" });
      yield* customizations.writeFile({
        cwd: workspace,
        path: "~/.claude/agents/y.md",
        contents: "y",
      });
      expect(yield* fileSystem.readFileString(path.join(codexDir, "skills", "x", "SKILL.md"))).toBe(
        "s",
      );
      expect(yield* fileSystem.readFileString(path.join(configDir, "agents", "y.md"))).toBe("y");
      expect(yield* fileSystem.readFileString(path.join(workspace, "AGENTS.md"))).toBe("a");
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("keeps Codex auth and config out of reach and opens config.toml read-only", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, codexDir, workspace } = yield* makeSandbox;
      yield* put(path.join(codexDir, "config.toml"), "model = 'x'");
      yield* put(path.join(codexDir, "auth.json"), '{"token":"secret"}');
      const read = yield* customizations.readFile({ cwd: workspace, path: "~/.codex/config.toml" });
      expect(read).toMatchObject({ contents: "model = 'x'", readOnly: true });
      const readOnly = yield* customizations
        .writeFile({ cwd: workspace, path: "~/.codex/config.toml", contents: "x" })
        .pipe(Effect.flip);
      expect(readOnly).toMatchObject({
        _tag: "CustomizationsPathNotAllowedError",
        reason: "read_only",
      });
      for (const target of [
        "~/.codex/auth.json",
        "~/.codex/prompts/sub/deep.md",
        "~/.codex/prompts/notes.txt",
        "~/.codex/sessions/a.md",
        "~/.codex/../escape.md",
      ]) {
        for (const result of [
          yield* customizations
            .writeFile({ cwd: workspace, path: target, contents: "x" })
            .pipe(Effect.flip),
          yield* customizations.readFile({ cwd: workspace, path: target }).pipe(Effect.flip),
        ]) {
          expect(result._tag, target).toBe("CustomizationsPathNotAllowedError");
        }
      }
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("rejects writes outside the allowed roots", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, fileSystem, root, configDir, workspace, outside } = yield* makeSandbox;
      const rejected = [
        "../escape.md",
        ".claude/../../escape.md",
        path.join(workspace, ".claude", "..", "..", "escape.md"),
        path.join(outside, "escape.md"),
        "/etc/passwd",
        path.join(workspace, "src", "index.ts"),
        path.join(workspace, "package.json"),
        path.join(workspace, "CLAUDE.md.bak"),
        path.join(configDir, ".credentials.json"),
        path.join(configDir, ".credentials-backup", "x"),
        path.join(root, "claude-home-sibling.md"),
      ];
      for (const target of rejected) {
        const error = yield* customizations
          .writeFile({ cwd: workspace, path: target, contents: "x" })
          .pipe(Effect.flip);
        expect(error._tag, target).toBe("CustomizationsPathNotAllowedError");
      }
      expect(yield* fileSystem.exists(path.join(outside, "escape.md"))).toBe(false);
      expect(yield* fileSystem.exists(path.join(root, "escape.md"))).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect.skipIf(!symlinksSupported)(
    "rejects symlinks that point outside the allowed roots",
    () =>
      Effect.gen(function* () {
        const customizations = yield* Customizations.Customizations;
        const { path, fileSystem, configDir, workspace, outside } = yield* makeSandbox;
        yield* put(path.join(outside, "secret.md"), "original");
        yield* mkdirp(path.join(workspace, ".claude"));
        NodeFS.symlinkSync(outside, path.join(workspace, ".claude", "linked-dir"));
        NodeFS.symlinkSync(path.join(outside, "secret.md"), path.join(workspace, "CLAUDE.md"));
        NodeFS.symlinkSync(outside, path.join(configDir, "skills"));
        NodeFS.symlinkSync(path.join(outside, "ghost.md"), path.join(configDir, "dangling.md"));

        for (const target of [
          path.join(workspace, ".claude", "linked-dir", "new.md"),
          path.join(workspace, ".claude", "linked-dir", "secret.md"),
          path.join(workspace, "CLAUDE.md"),
          path.join(configDir, "skills", "x", "SKILL.md"),
          path.join(configDir, "dangling.md"),
        ]) {
          const write = yield* customizations
            .writeFile({ cwd: workspace, path: target, contents: "pwned" })
            .pipe(Effect.flip);
          expect(write._tag, target).toBe("CustomizationsPathNotAllowedError");
          const read = yield* customizations
            .readFile({ cwd: workspace, path: target })
            .pipe(Effect.flip);
          expect(read._tag, target).toBe("CustomizationsPathNotAllowedError");
        }
        expect(yield* fileSystem.readFileString(path.join(outside, "secret.md"))).toBe("original");
        expect(yield* fileSystem.exists(path.join(outside, "new.md"))).toBe(false);
        expect(yield* fileSystem.exists(path.join(outside, "ghost.md"))).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("opens the global Claude state file read-only and never saves it", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, fileSystem, configDir, workspace } = yield* makeSandbox;
      const claudeJson = path.join(configDir, ".claude.json");
      yield* put(claudeJson, '{"mcpServers":{}}');

      const read = yield* customizations.readFile({ cwd: workspace, path: claudeJson });
      expect(read).toMatchObject({ contents: '{"mcpServers":{}}', readOnly: true });
      const error = yield* customizations
        .writeFile({ cwd: workspace, path: claudeJson, contents: "{}" })
        .pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "CustomizationsPathNotAllowedError",
        reason: "read_only",
      });
      expect(yield* fileSystem.readFileString(claudeJson)).toBe('{"mcpServers":{}}');
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );

  it.effect("refuses to read credentials and unrelated files, and unregistered projects", () =>
    Effect.gen(function* () {
      const customizations = yield* Customizations.Customizations;
      const { path, configDir, workspace, outside } = yield* makeSandbox;
      yield* put(path.join(configDir, ".credentials.json"), "token");
      yield* put(path.join(outside, "notes.md"), "x");
      for (const target of [
        path.join(configDir, ".credentials.json"),
        path.join(outside, "notes.md"),
        "/etc/passwd",
      ]) {
        const error = yield* customizations
          .readFile({ cwd: workspace, path: target })
          .pipe(Effect.flip);
        expect(error._tag, target).toBe("CustomizationsPathNotAllowedError");
      }
      const unregistered = yield* customizations
        .writeFile({ cwd: outside, path: path.join(outside, "CLAUDE.md"), contents: "x" })
        .pipe(Effect.flip);
      expect(unregistered._tag).toBe("CustomizationsCwdNotRegisteredError");
    }).pipe(Effect.scoped, Effect.provide(TestLayer)),
  );
});
