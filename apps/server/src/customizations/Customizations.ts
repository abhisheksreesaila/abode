/**
 * Customizations - lists, reads and saves the Claude Code files that shape a
 * workspace: skills, agents, MCP server declarations and instruction files.
 *
 * Every file operation is confined to a small allow-list of roots, checked
 * after symlinks are resolved (see `resolveTarget`). MCP entries expose only
 * their name and the file that declares them; the values inside (env, headers,
 * args, urls) are never parsed out of the file.
 *
 * @module customizations/Customizations
 */
import * as NodeOS from "node:os";

import {
  CustomizationsError,
  type CustomizationItem,
  type CustomizationScope,
  type CustomizationsListInput,
  type CustomizationsListResult,
  type CustomizationsReadFileInput,
  type CustomizationsReadFileResult,
  type CustomizationsWriteFileInput,
  type CustomizationsWriteFileResult,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { parse as parseYamlDocument } from "yaml";

import { expandHomePathWith } from "../pathExpansion.ts";
import { discoverClaudeSkills } from "../provider/Drivers/ClaudeSkills.ts";
import { resolveClaudeHomePath } from "../provider/Drivers/ClaudeHome.ts";
import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";

const CUSTOMIZATIONS_READ_MAX_BYTES = 1024 * 1024;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const WORKSPACE_WRITABLE_FILES = [
  ".mcp.json",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "AGENTS.md",
] as const;

export class CustomizationsCwdNotRegisteredError extends Schema.TaggedError<CustomizationsCwdNotRegisteredError>()(
  "CustomizationsCwdNotRegisteredError",
  { cwd: Schema.String },
) {
  override get message(): string {
    return `'${this.cwd}' is not a registered project.`;
  }
}

export class CustomizationsPathNotAllowedError extends Schema.TaggedError<CustomizationsPathNotAllowedError>()(
  "CustomizationsPathNotAllowedError",
  {
    path: Schema.String,
    reason: Schema.Literals(["outside_roots", "read_only"]),
  },
) {
  override get message(): string {
    return this.reason === "read_only"
      ? `'${this.path}' can be opened but not saved.`
      : `'${this.path}' is outside the Claude customization folders.`;
  }
}

export class CustomizationsFileTooLargeError extends Schema.TaggedError<CustomizationsFileTooLargeError>()(
  "CustomizationsFileTooLargeError",
  { path: Schema.String, byteLength: Schema.Number },
) {
  override get message(): string {
    return `'${this.path}' is too large to open (${this.byteLength} bytes).`;
  }
}

export class CustomizationsFileError extends Schema.TaggedError<CustomizationsFileError>()(
  "CustomizationsFileError",
  {
    path: Schema.String,
    operation: Schema.Literals(["read", "write"]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation} '${this.path}'.`;
  }
}

export type CustomizationsServiceError =
  | CustomizationsCwdNotRegisteredError
  | CustomizationsPathNotAllowedError
  | CustomizationsFileTooLargeError
  | CustomizationsFileError;

/** Maps a service failure to the wire error; used by every transport. */
export function toCustomizationsError(error: CustomizationsServiceError): CustomizationsError {
  switch (error._tag) {
    case "CustomizationsCwdNotRegisteredError":
      return new CustomizationsError({ failure: "cwd_not_registered", message: error.message });
    case "CustomizationsPathNotAllowedError":
      return new CustomizationsError({
        failure: error.reason === "read_only" ? "read_only" : "path_not_allowed",
        message: error.message,
      });
    case "CustomizationsFileTooLargeError":
      return new CustomizationsError({ failure: "file_too_large", message: error.message });
    case "CustomizationsFileError":
      return new CustomizationsError({
        failure: "operation_failed",
        message: error.message,
        cause: error.cause,
      });
  }
}

export class Customizations extends Context.Service<
  Customizations,
  {
    readonly list: (
      input: CustomizationsListInput,
    ) => Effect.Effect<CustomizationsListResult, CustomizationsServiceError>;
    readonly readFile: (
      input: CustomizationsReadFileInput,
    ) => Effect.Effect<CustomizationsReadFileResult, CustomizationsServiceError>;
    readonly writeFile: (
      input: CustomizationsWriteFileInput,
    ) => Effect.Effect<CustomizationsWriteFileResult, CustomizationsServiceError>;
  }
>()("t3/customizations/Customizations") {}

/** `name` and `description` from a markdown file's YAML frontmatter, when present. */
function parseFrontmatter(contents: string): {
  readonly name?: string;
  readonly description?: string;
} {
  const match = FRONTMATTER_PATTERN.exec(contents);
  if (!match) return {};
  let parsed: unknown;
  try {
    parsed = parseYamlDocument(match[1] ?? "");
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  const record = parsed as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  return { ...(name ? { name } : {}), ...(description ? { description } : {}) };
}

/** Only the keys of a `mcpServers` object. Values are never read. */
function mcpServerNames(value: unknown): ReadonlyArray<string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.keys(value).filter((name) => name.trim().length > 0);
}

const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const projectionSnapshotQuery = yield* ProjectionSnapshotQuery.ProjectionSnapshotQuery;

  const resolveConfigDir = resolveClaudeHomePath({ homePath: "" }, process.env).pipe(
    Effect.provideService(Path.Path, path),
  );

  /** Codex reads `CODEX_HOME` when set, `~/.codex` otherwise. */
  const codexHomeDir = () => {
    const configured = process.env.CODEX_HOME?.trim() ?? "";
    return configured.length > 0
      ? path.resolve(expandHomePathWith(configured, path))
      : path.join(NodeOS.homedir(), ".codex");
  };

  /**
   * `~/.claude/...` and `~/.codex/...` name the user-scope folders without the client knowing
   * the home directory; they map onto the same dirs the lists use (so `CLAUDE_CONFIG_DIR` and
   * `CODEX_HOME` are honored). Any other path is returned unchanged.
   */
  const expandUserScopePath = (requested: string, configDir: string) => {
    for (const [prefix, root] of [
      ["~/.claude", configDir],
      ["~/.codex", codexHomeDir()],
    ] as const) {
      if (requested === prefix) return root;
      if (requested.startsWith(`${prefix}/`)) {
        return path.join(root, requested.slice(prefix.length + 1));
      }
    }
    return requested;
  };

  /**
   * Claude keeps its global state file inside `CLAUDE_CONFIG_DIR` when that is
   * set, and next to it (`~/.claude.json`) otherwise.
   */
  const claudeJsonPathFor = (configDir: string) =>
    (process.env.CLAUDE_CONFIG_DIR?.trim() ?? "").length > 0
      ? path.join(configDir, ".claude.json")
      : path.join(NodeOS.homedir(), ".claude.json");

  /**
   * realpath of the deepest existing ancestor, with the not-yet-created tail
   * appended. A dangling symlink is followed to where it would create the file,
   * so a link pointing outside the roots cannot be written through.
   */
  const realPathAllowingMissing = (absolutePath: string): Effect.Effect<string> =>
    Effect.gen(function* () {
      const tail: Array<string> = [];
      let current = absolutePath;
      let links = 0;
      while (true) {
        const real = yield* fileSystem
          .realPath(current)
          .pipe(Effect.orElseSucceed(() => undefined));
        if (real !== undefined) return path.join(real, ...tail);
        const target = yield* fileSystem
          .readLink(current)
          .pipe(Effect.orElseSucceed(() => undefined));
        if (target !== undefined && links < 40) {
          links += 1;
          current = path.resolve(path.dirname(current), target);
          continue;
        }
        const parent = path.dirname(current);
        if (parent === current) return absolutePath;
        tail.unshift(path.basename(current));
        current = parent;
      }
    });

  const isInside = (root: string, candidate: string) => {
    const relative = path.relative(root, candidate);
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
  };

  const requireRegisteredCwd = Effect.fn("Customizations.requireRegisteredCwd")(function* (
    cwd: string,
  ) {
    const candidates = [...new Set([cwd, path.resolve(cwd)])];
    for (const candidate of candidates) {
      const project = yield* projectionSnapshotQuery
        .getActiveProjectByWorkspaceRoot(candidate)
        .pipe(Effect.orElseSucceed(() => Option.none()));
      if (Option.isSome(project)) return project.value.workspaceRoot;
    }
    return yield* new CustomizationsCwdNotRegisteredError({ cwd });
  });

  /**
   * Resolves a requested path to the real path an operation may touch. The
   * request is rejected when it contains a `..` segment, and again when its
   * symlink-resolved location is outside the allowed roots, so neither
   * traversal nor a symlink pointing out can escape.
   *
   * Writable: anything under the Claude config dir (except `.credentials*` and
   * the global state file) and, in the workspace, `.claude/`, `.mcp.json`,
   * `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md`. The global state file is readable but
   * never writable, since it also holds private state.
   *
   * Codex: only `<codex home>/skills/**` and `<codex home>/prompts/*.md` are writable;
   * `config.toml` opens read-only, and everything else there (`auth.json` included) is denied.
   */
  const resolveTarget = Effect.fn("Customizations.resolveTarget")(function* (
    input: { readonly cwd: string; readonly path: string },
    mode: "read" | "write",
  ) {
    const workspaceRoot = yield* requireRegisteredCwd(input.cwd);
    const requested = input.path.trim();
    const denied = (reason: "outside_roots" | "read_only" = "outside_roots") =>
      new CustomizationsPathNotAllowedError({ path: requested, reason });

    if (requested.split(/[\\/]/).includes("..")) return yield* denied();
    const configDir = yield* resolveConfigDir;
    const expanded = expandUserScopePath(requested, configDir);
    const absolutePath = path.resolve(workspaceRoot, expanded);
    // A `~/` request is answered with the absolute path, so clients can open what they wrote.
    const resolvedPath = expanded === requested ? input.path : absolutePath;
    const realConfigDir = yield* realPathAllowingMissing(configDir);
    const realWorkspaceRoot = yield* realPathAllowingMissing(workspaceRoot);
    const realClaudeJson = yield* realPathAllowingMissing(claudeJsonPathFor(configDir));
    const realTarget = yield* realPathAllowingMissing(absolutePath);
    const realCodexHome = yield* realPathAllowingMissing(codexHomeDir());

    if (realTarget === realClaudeJson || realTarget === path.join(realCodexHome, "config.toml")) {
      return mode === "read"
        ? { realTarget, readOnly: true, resolvedPath }
        : yield* denied("read_only");
    }

    const underConfigDir = isInside(realConfigDir, realTarget);
    const isCredentials =
      underConfigDir &&
      path
        .relative(realConfigDir, realTarget)
        .split(path.sep)
        .some((segment) => segment.startsWith(".credentials"));
    const underCodexSkills = isInside(path.join(realCodexHome, "skills"), realTarget);
    const isCodexPrompt =
      path.dirname(realTarget) === path.join(realCodexHome, "prompts") &&
      realTarget.endsWith(".md");
    const allowed =
      !isCredentials &&
      (underConfigDir ||
        underCodexSkills ||
        isCodexPrompt ||
        isInside(path.join(realWorkspaceRoot, ".claude"), realTarget) ||
        WORKSPACE_WRITABLE_FILES.some((file) => realTarget === path.join(realWorkspaceRoot, file)));
    if (!allowed) return yield* denied();
    return { realTarget, readOnly: false, resolvedPath };
  });

  const list = Effect.fn("Customizations.list")(function* (input: CustomizationsListInput) {
    const workspaceRoot = yield* requireRegisteredCwd(input.cwd);
    const configDir = yield* resolveConfigDir;
    const claudeJsonPath = claudeJsonPathFor(configDir);
    const items: Array<CustomizationItem> = [];
    const exists = (candidate: string) =>
      fileSystem.exists(candidate).pipe(Effect.orElseSucceed(() => false));
    const readText = (candidate: string) =>
      fileSystem.readFileString(candidate).pipe(Effect.orElseSucceed(() => undefined));

    const skills = yield* discoverClaudeSkills({ homePath: "" }, workspaceRoot, process.env).pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, path),
    );
    for (const skill of skills) {
      items.push({
        kind: "skill",
        name: skill.name,
        ...(skill.description ? { description: skill.description } : {}),
        path: skill.path,
        scope: skill.scope === "user" ? "user" : "workspace",
        readOnly: false,
        harness: "claude",
      });
    }

    // Codex: skills are `<codex home>/skills/<name>/SKILL.md`; custom prompts are
    // `<codex home>/prompts/<name>.md`, listed with the agents.
    const codexDir = codexHomeDir();
    const skillDirs = yield* fileSystem
      .readDirectory(path.join(codexDir, "skills"))
      .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    for (const entry of [...skillDirs].sort()) {
      if (entry.startsWith(".")) continue;
      const skillPath = path.join(codexDir, "skills", entry, "SKILL.md");
      const contents = yield* readText(skillPath);
      if (contents === undefined) continue;
      const frontmatter = parseFrontmatter(contents);
      items.push({
        kind: "skill",
        name: frontmatter.name ?? entry,
        ...(frontmatter.description ? { description: frontmatter.description } : {}),
        path: skillPath,
        scope: "user",
        readOnly: false,
        harness: "codex",
      });
    }
    const promptFiles = yield* fileSystem
      .readDirectory(path.join(codexDir, "prompts"))
      .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    for (const entry of [...promptFiles].sort()) {
      if (!entry.endsWith(".md") || entry.startsWith(".")) continue;
      const promptPath = path.join(codexDir, "prompts", entry);
      const contents = yield* readText(promptPath);
      if (contents === undefined) continue;
      const frontmatter = parseFrontmatter(contents);
      items.push({
        kind: "agent",
        name: entry.slice(0, -".md".length),
        ...(frontmatter.description ? { description: frontmatter.description } : {}),
        path: promptPath,
        scope: "user",
        readOnly: false,
        harness: "codex",
      });
    }

    // Codex declares MCP servers in config.toml; the file opens read-only (values are never parsed).
    const codexConfigPath = path.join(codexDir, "config.toml");
    if (yield* exists(codexConfigPath)) {
      items.push({
        kind: "mcp",
        name: "config.toml",
        description: "Codex MCP servers and settings (read-only)",
        path: codexConfigPath,
        scope: "user",
        readOnly: true,
        harness: "codex",
      });
    }

    const agentRoots: ReadonlyArray<readonly [string, CustomizationScope]> = [
      [path.join(configDir, "agents"), "user"],
      [path.join(workspaceRoot, ".claude", "agents"), "workspace"],
    ];
    for (const [directory, scope] of agentRoots) {
      const entries = yield* fileSystem
        .readDirectory(directory)
        .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
      for (const entry of [...entries].sort()) {
        if (!entry.endsWith(".md")) continue;
        const agentPath = path.join(directory, entry);
        const contents = yield* readText(agentPath);
        if (contents === undefined) continue;
        const frontmatter = parseFrontmatter(contents);
        items.push({
          kind: "agent",
          name: frontmatter.name ?? entry.slice(0, -".md".length),
          ...(frontmatter.description ? { description: frontmatter.description } : {}),
          path: agentPath,
          scope,
          readOnly: false,
          harness: "claude",
        });
      }
    }

    const pushMcp = (
      names: ReadonlyArray<string>,
      filePath: string,
      scope: CustomizationScope,
      readOnly: boolean,
    ) => {
      for (const name of names) {
        items.push({ kind: "mcp", name, path: filePath, scope, readOnly, harness: "claude" });
      }
    };
    const parseJson = (text: string | undefined): unknown => {
      if (text === undefined) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    };
    const field = (value: unknown, key: string): unknown =>
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[key]
        : undefined;

    const mcpJsonPath = path.join(workspaceRoot, ".mcp.json");
    pushMcp(
      mcpServerNames(field(parseJson(yield* readText(mcpJsonPath)), "mcpServers")),
      mcpJsonPath,
      "workspace",
      false,
    );
    const claudeJson = parseJson(yield* readText(claudeJsonPath));
    pushMcp(mcpServerNames(field(claudeJson, "mcpServers")), claudeJsonPath, "user", true);
    const projectEntry = field(field(claudeJson, "projects"), workspaceRoot);
    pushMcp(mcpServerNames(field(projectEntry, "mcpServers")), claudeJsonPath, "workspace", true);

    const instructionFiles: ReadonlyArray<readonly [string, string, CustomizationScope]> = [
      [path.join(configDir, "CLAUDE.md"), "CLAUDE.md", "user"],
      [path.join(workspaceRoot, "CLAUDE.md"), "CLAUDE.md", "workspace"],
      [path.join(workspaceRoot, "CLAUDE.local.md"), "CLAUDE.local.md", "workspace"],
      [path.join(workspaceRoot, ".claude", "CLAUDE.md"), ".claude/CLAUDE.md", "workspace"],
    ];
    for (const [filePath, name, scope] of instructionFiles) {
      if (yield* exists(filePath)) {
        items.push({
          kind: "instructions",
          name,
          path: filePath,
          scope,
          readOnly: false,
          harness: "claude",
        });
      }
    }
    const agentsMdPath = path.join(workspaceRoot, "AGENTS.md");
    if (yield* exists(agentsMdPath)) {
      items.push({
        kind: "instructions",
        name: "AGENTS.md",
        path: agentsMdPath,
        scope: "workspace",
        readOnly: false,
        harness: "codex",
      });
    }

    // Claude Code lets the most specific settings file name the main agent.
    let defaultAgent: string | undefined;
    for (const settingsPath of [
      path.join(workspaceRoot, ".claude", "settings.local.json"),
      path.join(workspaceRoot, ".claude", "settings.json"),
      path.join(configDir, "settings.json"),
    ]) {
      const value = field(parseJson(yield* readText(settingsPath)), "agent");
      if (typeof value === "string" && value.trim().length > 0) {
        defaultAgent = value.trim();
        break;
      }
    }

    return { items, ...(defaultAgent ? { defaultAgent } : {}) };
  });

  const readFile = Effect.fn("Customizations.readFile")(function* (
    input: CustomizationsReadFileInput,
  ) {
    const { realTarget, readOnly, resolvedPath } = yield* resolveTarget(input, "read");
    const fileError = (cause: unknown) =>
      new CustomizationsFileError({ path: input.path, operation: "read", cause });
    const info = yield* fileSystem.stat(realTarget).pipe(Effect.mapError(fileError));
    if (Number(info.size) > CUSTOMIZATIONS_READ_MAX_BYTES) {
      return yield* new CustomizationsFileTooLargeError({
        path: input.path,
        byteLength: Number(info.size),
      });
    }
    const contents = yield* fileSystem.readFileString(realTarget).pipe(Effect.mapError(fileError));
    return { path: resolvedPath, contents, readOnly };
  });

  const writeFile = Effect.fn("Customizations.writeFile")(function* (
    input: CustomizationsWriteFileInput,
  ) {
    const { realTarget, resolvedPath } = yield* resolveTarget(input, "write");
    const fileError = (cause: unknown) =>
      new CustomizationsFileError({ path: input.path, operation: "write", cause });
    yield* fileSystem
      .makeDirectory(path.dirname(realTarget), { recursive: true })
      .pipe(Effect.mapError(fileError));
    yield* fileSystem.writeFileString(realTarget, input.contents).pipe(Effect.mapError(fileError));
    return { path: resolvedPath, byteLength: Buffer.byteLength(input.contents) };
  });

  return Customizations.of({ list, readFile, writeFile });
});

export const layer = Layer.effect(Customizations, make);
