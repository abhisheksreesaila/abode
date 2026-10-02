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

import { discoverClaudeSkills } from "../provider/Drivers/ClaudeSkills.ts";
import { resolveClaudeHomePath } from "../provider/Drivers/ClaudeHome.ts";
import * as ProjectionSnapshotQuery from "../orchestration/Services/ProjectionSnapshotQuery.ts";

const CUSTOMIZATIONS_READ_MAX_BYTES = 1024 * 1024;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const WORKSPACE_WRITABLE_FILES = [".mcp.json", "CLAUDE.md", "CLAUDE.local.md"] as const;

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
   * `CLAUDE.md` and `CLAUDE.local.md`. The global state file is readable but
   * never writable, since it also holds private state.
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
    const absolutePath = path.resolve(workspaceRoot, requested);

    const configDir = yield* resolveConfigDir;
    const realConfigDir = yield* realPathAllowingMissing(configDir);
    const realWorkspaceRoot = yield* realPathAllowingMissing(workspaceRoot);
    const realClaudeJson = yield* realPathAllowingMissing(claudeJsonPathFor(configDir));
    const realTarget = yield* realPathAllowingMissing(absolutePath);

    if (realTarget === realClaudeJson) {
      return mode === "read" ? { realTarget, readOnly: true } : yield* denied("read_only");
    }

    const underConfigDir = isInside(realConfigDir, realTarget);
    const isCredentials =
      underConfigDir &&
      path
        .relative(realConfigDir, realTarget)
        .split(path.sep)
        .some((segment) => segment.startsWith(".credentials"));
    const allowed =
      !isCredentials &&
      (underConfigDir ||
        isInside(path.join(realWorkspaceRoot, ".claude"), realTarget) ||
        WORKSPACE_WRITABLE_FILES.some((file) => realTarget === path.join(realWorkspaceRoot, file)));
    if (!allowed) return yield* denied();
    return { realTarget, readOnly: false };
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
        items.push({ kind: "mcp", name, path: filePath, scope, readOnly });
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
        items.push({ kind: "instructions", name, path: filePath, scope, readOnly: false });
      }
    }

    return { items };
  });

  const readFile = Effect.fn("Customizations.readFile")(function* (
    input: CustomizationsReadFileInput,
  ) {
    const { realTarget, readOnly } = yield* resolveTarget(input, "read");
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
    return { path: input.path, contents, readOnly };
  });

  const writeFile = Effect.fn("Customizations.writeFile")(function* (
    input: CustomizationsWriteFileInput,
  ) {
    const { realTarget } = yield* resolveTarget(input, "write");
    const fileError = (cause: unknown) =>
      new CustomizationsFileError({ path: input.path, operation: "write", cause });
    yield* fileSystem
      .makeDirectory(path.dirname(realTarget), { recursive: true })
      .pipe(Effect.mapError(fileError));
    yield* fileSystem.writeFileString(realTarget, input.contents).pipe(Effect.mapError(fileError));
    return { path: input.path, byteLength: Buffer.byteLength(input.contents) };
  });

  return Customizations.of({ list, readFile, writeFile });
});

export const layer = Layer.effect(Customizations, make);
