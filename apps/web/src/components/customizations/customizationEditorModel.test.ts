import { describe, expect, it } from "vitest";

import {
  canSave,
  cursorPosition,
  decideClose,
  languageForPath,
  modeAfterCreate,
  parseFrontmatter,
  validateCustomization,
} from "./customizationEditorModel";

const SKILL = "/home/me/.claude/skills/x/SKILL.md";

describe("languageForPath", () => {
  it("maps extensions", () => {
    expect(languageForPath("~/.claude/skills/x/SKILL.md")).toBe("markdown");
    expect(languageForPath("/w/.mcp.json")).toBe("json");
    expect(languageForPath("~/.codex/config.toml")).toBe("toml");
    expect(languageForPath("/w/notes.txt")).toBe("text");
  });
});

describe("parseFrontmatter", () => {
  it("reads top-level keys", () => {
    const parsed = parseFrontmatter("---\nname: a\ndescription: b c\n---\nbody");
    expect(parsed).toEqual({ fields: { name: "a", description: "b c" }, badLines: [] });
  });
  it("returns null without frontmatter and flags an unclosed block", () => {
    expect(parseFrontmatter("# Title")).toBeNull();
    expect(parseFrontmatter("---\nname: a\n")).toBe("unterminated");
  });
  it("accepts comments, block scalars and list continuations", () => {
    const parsed = parseFrontmatter(
      "---\nname: a\n# tools: x\ndescription: >\n  folded\n  text\ntools:\n  - Read\n---\n",
    );
    expect((parsed as { badLines: number[] }).badLines).toEqual([]);
  });
  it("flags lines that are not key: value", () => {
    const parsed = parseFrontmatter("---\nname: a\nnot yaml here\n---\n");
    expect((parsed as { badLines: number[] }).badLines).toEqual([3]);
  });
});

describe("validateCustomization", () => {
  it("passes a complete skill", () => {
    expect(
      validateCustomization({ path: SKILL, contents: "---\nname: a\ndescription: b\n---\n" }),
    ).toEqual([]);
  });
  it("warns about a missing description with the Claude explanation", () => {
    const hints = validateCustomization({ path: SKILL, contents: "---\nname: a\n---\n" });
    expect(hints.map((hint) => hint.message)).toEqual([
      "Missing description: Claude uses it to decide when to load this skill",
    ]);
  });
  it("treats empty values as missing", () => {
    const hints = validateCustomization({
      path: SKILL,
      contents: '---\nname: ""\ndescription:\n---\n',
    });
    expect(hints).toHaveLength(2);
  });
  it("warns when a skill has no frontmatter or an unclosed one", () => {
    expect(validateCustomization({ path: SKILL, contents: "# hi" })[0]?.message).toMatch(
      /Missing frontmatter/,
    );
    expect(validateCustomization({ path: SKILL, contents: "---\nname: a" })[0]?.message).toMatch(
      /not closed/,
    );
  });
  it("checks agent markdown files but not other markdown", () => {
    const agent = "/w/.claude/agents/reviewer.md";
    expect(validateCustomization({ path: agent, contents: "---\nname: r\n---\n" })).toHaveLength(1);
    expect(validateCustomization({ path: "/w/CLAUDE.md", contents: "# hi" })).toEqual([]);
  });
  it(".mcp.json must be JSON with an mcpServers object", () => {
    const path = "/w/.mcp.json";
    expect(validateCustomization({ path, contents: '{"mcpServers":{}}' })).toEqual([]);
    expect(validateCustomization({ path, contents: "{" })[0]?.message).toMatch(/^Invalid JSON/);
    expect(validateCustomization({ path, contents: "{}" })[0]?.message).toMatch(/mcpServers/);
    expect(validateCustomization({ path, contents: '{"mcpServers":[]}' })).toHaveLength(1);
  });
});

describe("cursorPosition", () => {
  it("is 1-based and counts columns from the line start", () => {
    expect(cursorPosition("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
    expect(cursorPosition("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
    expect(cursorPosition("ab\ncd", 99)).toEqual({ line: 2, column: 3 });
  });
});

describe("decideClose", () => {
  it("Esc leaves full screen first, even when dirty", () => {
    expect(decideClose({ dirty: true, maximized: true, viaEscape: true })).toBe("exit-fullscreen");
  });
  it("prompts when dirty, otherwise closes", () => {
    expect(decideClose({ dirty: true, maximized: false, viaEscape: true })).toBe("confirm-discard");
    expect(decideClose({ dirty: false, maximized: false, viaEscape: true })).toBe("close");
  });
  it("the Close button ignores full screen", () => {
    expect(decideClose({ dirty: false, maximized: true, viaEscape: false })).toBe("close");
    expect(decideClose({ dirty: true, maximized: true, viaEscape: false })).toBe("confirm-discard");
  });
});

describe("create to edit", () => {
  it("switches to editing the written file", () => {
    expect(modeAfterCreate({ path: "/home/me/.claude/skills/x/SKILL.md" })).toEqual({
      type: "edit",
      path: "/home/me/.claude/skills/x/SKILL.md",
    });
  });
});

describe("canSave", () => {
  const base = { dirty: true, locked: false, saving: false, creating: false, hasPlan: true };
  it("needs dirty, unlocked and idle when editing", () => {
    expect(canSave(base)).toBe(true);
    expect(canSave({ ...base, dirty: false })).toBe(false);
    expect(canSave({ ...base, locked: true })).toBe(false);
    expect(canSave({ ...base, saving: true })).toBe(false);
  });
  it("creating only needs a plan", () => {
    expect(canSave({ ...base, creating: true, dirty: false, locked: true })).toBe(true);
    expect(canSave({ ...base, creating: true, hasPlan: false })).toBe(false);
  });
});
