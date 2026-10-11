/**
 * Pure logic behind the customization editor (abode F-045): language and validation hints for the
 * status line, the dirty and close guard, and what happens after a create. No file contents are
 * kept anywhere: every function takes the text it should look at and returns plain data.
 */

export type EditorLanguage = "markdown" | "json" | "toml" | "text";

export function languageForPath(path: string): EditorLanguage {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".toml")) return "toml";
  return "text";
}

export interface ValidationHint {
  /** Hints are warnings: they never block saving. */
  readonly severity: "warning";
  readonly message: string;
}

export interface Frontmatter {
  readonly fields: Readonly<Record<string, string>>;
  /** 1-based lines of the block that are neither `key: value`, a comment, nor a continuation. */
  readonly badLines: ReadonlyArray<number>;
}

/**
 * Reads a leading `---` YAML block. Returns `null` when there is none, and `"unterminated"` when it
 * opens but never closes. Only top-level scalar keys matter here, so this is not a full YAML parser.
 */
export function parseFrontmatter(contents: string): Frontmatter | null | "unterminated" {
  const lines = contents.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return "unterminated";
  const fields: Record<string, string> = {};
  const badLines: number[] = [];
  for (let index = 1; index < end; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    // Indented text and list items continue the previous key (folded text, lists, nested maps).
    if (/^\s/.test(line) || line.startsWith("- ")) {
      if (Object.keys(fields).length === 0) badLines.push(index + 1);
      continue;
    }
    const match = /^([A-Za-z0-9_-]+)\s*:(?:\s+(.*)|\s*)$/.exec(line);
    if (!match) {
      badLines.push(index + 1);
      continue;
    }
    fields[match[1] as string] = (match[2] ?? "").trim();
  }
  return { fields, badLines };
}

function isBlankValue(value: string | undefined): boolean {
  if (value === undefined) return true;
  return value.replace(/^["']|["']$/g, "").trim() === "";
}

type FileRole = "skill" | "agent" | "mcp" | "other";

function roleForPath(path: string): FileRole {
  const normalized = path.replaceAll("\\", "/");
  const name = normalized.split("/").pop() ?? normalized;
  if (name === "SKILL.md") return "skill";
  if (name === ".mcp.json") return "mcp";
  if (name.endsWith(".md") && normalized.includes("/.claude/agents/")) return "agent";
  if (name.endsWith(".md") && normalized.startsWith("~/.claude/agents/")) return "agent";
  return "other";
}

function validateFrontmatter(contents: string, noun: "skill" | "agent"): ValidationHint[] {
  const parsed = parseFrontmatter(contents);
  if (parsed === null) {
    return [
      {
        severity: "warning",
        message: `Missing frontmatter: a ${noun} starts with a --- block holding name and description.`,
      },
    ];
  }
  if (parsed === "unterminated") {
    return [{ severity: "warning", message: "Frontmatter is not closed: add a closing --- line." }];
  }
  const hints: ValidationHint[] = [];
  if (parsed.badLines.length > 0) {
    hints.push({
      severity: "warning",
      message: `Frontmatter line ${parsed.badLines[0]} is not valid YAML (expected key: value).`,
    });
  }
  if (isBlankValue(parsed.fields.name)) {
    hints.push({ severity: "warning", message: "Missing name in the frontmatter." });
  }
  if (isBlankValue(parsed.fields.description)) {
    hints.push({
      severity: "warning",
      message: `Missing description: Claude uses it to decide when to ${
        noun === "agent" ? "delegate to this agent" : "load this skill"
      }`,
    });
  }
  return hints;
}

function jsonProblem(contents: string): { readonly value: unknown } | { readonly hint: string } {
  try {
    return { value: JSON.parse(contents) as unknown };
  } catch (error) {
    return { hint: `Invalid JSON: ${error instanceof SyntaxError ? error.message : "no parse"}` };
  }
}

function validateMcpJson(contents: string): ValidationHint[] {
  const result = jsonProblem(contents);
  if ("hint" in result) return [{ severity: "warning", message: result.hint }];
  const root = result.value;
  const servers =
    typeof root === "object" && root !== null
      ? (root as { mcpServers?: unknown }).mcpServers
      : undefined;
  if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
    return [{ severity: "warning", message: "Expected an mcpServers object at the top level." }];
  }
  return [];
}

/** Warnings for the footer. An empty list means the file looks fine. */
export function validateCustomization(input: {
  readonly path: string;
  readonly contents: string;
}): ReadonlyArray<ValidationHint> {
  const { path, contents } = input;
  switch (roleForPath(path)) {
    case "skill":
      return validateFrontmatter(contents, "skill");
    case "agent":
      return validateFrontmatter(contents, "agent");
    case "mcp":
      return validateMcpJson(contents);
    default: {
      if (languageForPath(path) !== "json" || contents.trim() === "") return [];
      const result = jsonProblem(contents);
      return "hint" in result ? [{ severity: "warning", message: result.hint }] : [];
    }
  }
}

/** 1-based line and column of a character offset. */
export function cursorPosition(
  contents: string,
  offset: number,
): { readonly line: number; readonly column: number } {
  const clamped = Math.max(0, Math.min(offset, contents.length));
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < clamped; index += 1) {
    if (contents.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

export function isDirty(saved: string, current: string): boolean {
  return saved !== current;
}

/** Save needs something to write, an unlocked file and no save in flight. */
export function canSave(input: {
  readonly dirty: boolean;
  readonly locked: boolean;
  readonly saving: boolean;
  readonly creating: boolean;
  readonly hasPlan: boolean;
}): boolean {
  if (input.saving) return false;
  if (input.creating) return input.hasPlan;
  return input.dirty && !input.locked;
}

export type LoadResolution = "clean" | "restore" | "conflict";

/**
 * What to do with an unsaved draft when a file is opened again. A draft made against the same
 * disk text is restored; one made against older text is a conflict the person must settle.
 */
export function resolveLoad(input: {
  readonly onDisk: string;
  readonly draft: { readonly saved: string } | null;
}): LoadResolution {
  if (input.draft === null) return "clean";
  return input.draft.saved === input.onDisk ? "restore" : "conflict";
}

/** True when the file on disk is no longer the text this editor loaded (Claude edits skills too). */
export function changedOnDisk(input: {
  readonly loaded: string;
  readonly onDisk: string;
}): boolean {
  return input.loaded !== input.onDisk;
}

/** Skill files are what the composer's `$` picker lists, so saving one refreshes that list. */
export function isSkillFile(path: string): boolean {
  return path.replaceAll("\\", "/").endsWith("/SKILL.md");
}

/** "Keep my edits" after the file changed on disk: show the draft, as an edit of the new disk text. */
export function keepMyEdits(input: { readonly onDisk: string; readonly mine: string }): {
  readonly saved: string;
  readonly contents: string;
} {
  return { saved: input.onDisk, contents: input.mine };
}
