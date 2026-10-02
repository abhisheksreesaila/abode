import type { CustomizationItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  canUnlock,
  customizationScopeForPath,
  defaultLocked,
  describeCustomizationsError,
  displayCustomizationPath,
  findKnownCustomization,
  groupCustomizations,
  isCustomizationPath,
  newCustomizationTemplate,
  nextNewCustomization,
  rememberCustomizations,
  resolveLocked,
} from "./customizationsModel";

const item = (overrides: Partial<CustomizationItem>): CustomizationItem =>
  ({
    kind: "skill",
    name: "x",
    path: "/w/.claude/skills/x/SKILL.md",
    scope: "workspace",
    readOnly: false,
    ...overrides,
  }) as CustomizationItem;

describe("groupCustomizations", () => {
  it("returns the four groups in order with counts, including empty ones", () => {
    const groups = groupCustomizations([
      item({ kind: "mcp", name: "fs" }),
      item({ kind: "skill", name: "b" }),
      item({ kind: "skill", name: "a" }),
    ]);
    expect(groups.map((g) => [g.label, g.count])).toEqual([
      ["Skills", 2],
      ["Agent types", 0],
      ["MCP servers", 1],
      ["Instructions", 0],
    ]);
    expect(groups[1]?.emptyLabel).toBe("No agent types yet");
  });

  it("lists workspace items before user items, then by name", () => {
    const [skills] = groupCustomizations([
      item({ name: "z", scope: "workspace" }),
      item({ name: "a", scope: "user" }),
      item({ name: "b", scope: "workspace" }),
    ]);
    expect(skills?.items.map((i) => i.name)).toEqual(["b", "z", "a"]);
  });
});

describe("lock rules", () => {
  it("defaults user-scope and read-only items to locked, workspace to unlocked", () => {
    expect(defaultLocked({ scope: "user", readOnly: false })).toBe(true);
    expect(defaultLocked({ scope: "workspace", readOnly: false })).toBe(false);
    expect(defaultLocked({ scope: "workspace", readOnly: true })).toBe(true);
  });

  it("honors an explicit choice except for read-only files", () => {
    expect(resolveLocked({ scope: "user", readOnly: false, choice: false })).toBe(false);
    expect(resolveLocked({ scope: "workspace", readOnly: false, choice: true })).toBe(true);
    expect(resolveLocked({ scope: "user", readOnly: true, choice: false })).toBe(true);
    expect(canUnlock({ readOnly: true })).toBe(false);
    expect(canUnlock({ readOnly: false })).toBe(true);
  });
});

describe("describeCustomizationsError", () => {
  it("maps each failure to a distinct sentence", () => {
    const failures = [
      "cwd_not_registered",
      "path_not_allowed",
      "read_only",
      "file_too_large",
      "operation_failed",
    ];
    const messages = failures.map((failure) =>
      describeCustomizationsError({ _tag: "CustomizationsError", failure, message: "raw" }),
    );
    expect(new Set(messages).size).toBe(failures.length);
    expect(messages.every((m) => m !== "raw")).toBe(true);
  });

  it("falls back to the error message", () => {
    expect(describeCustomizationsError(new Error("offline"))).toBe("offline");
    expect(describeCustomizationsError("nope")).toBe("Something went wrong.");
  });
});

describe("paths", () => {
  it("routes only real customization locations", () => {
    const at = (path: string, panelCwd?: string) =>
      isCustomizationPath({ path, projectRoot: "/w", ...(panelCwd ? { panelCwd } : {}) });
    expect(at("/home/a/.claude.json")).toBe(true);
    expect(at("/home/a/.claude/agents/r.md")).toBe(true);
    expect(at("/w/CLAUDE.md")).toBe(true);
    expect(at("/w/.mcp.json")).toBe(true);
    expect(at("/w/.claude/skills/x/SKILL.md")).toBe(true);
    expect(at("/w/src/index.ts")).toBe(false);
    expect(at("/w/packages/x/CLAUDE.md")).toBe(false);
    expect(at("/w/.claude/worktrees/t/CLAUDE.md")).toBe(false);
    expect(at("/wt/CLAUDE.md", "/wt")).toBe(false);
    expect(at("/wt/.claude/skills/x/SKILL.md", "/wt")).toBe(false);
  });

  it("displays workspace files relative and user files under ~", () => {
    expect(displayCustomizationPath("/w/.claude/skills/x/SKILL.md", "/w")).toBe(
      ".claude/skills/x/SKILL.md",
    );
    expect(displayCustomizationPath("/home/a/.claude/CLAUDE.md", "/w")).toBe("~/.claude/CLAUDE.md");
    expect(displayCustomizationPath("/home/a/.claude.json", "/w")).toBe("~/.claude.json");
  });

  it("derives scope from the workspace root", () => {
    expect(customizationScopeForPath("/w/CLAUDE.md", "/w")).toBe("workspace");
    expect(customizationScopeForPath("/home/a/.claude/CLAUDE.md", "/w")).toBe("user");
  });

  it("remembers listed items by path", () => {
    const user = item({ path: "/home/a/.claude/CLAUDE.md", scope: "user" });
    rememberCustomizations([user]);
    expect(findKnownCustomization(user.path)).toBe(user);
  });
});

describe("new customization files", () => {
  it("never reuses an existing path", () => {
    expect(nextNewCustomization("skill", "/w", [])).toEqual({
      name: "new-skill",
      path: "/w/.claude/skills/new-skill/SKILL.md",
    });
    expect(
      nextNewCustomization("skill", "/w/", ["/w/.claude/skills/new-skill/SKILL.md"]).path,
    ).toBe("/w/.claude/skills/new-skill-2/SKILL.md");
    expect(nextNewCustomization("agent", "/w", []).path).toBe("/w/.claude/agents/new-agent.md");
  });

  it("templates carry the name in frontmatter", () => {
    expect(newCustomizationTemplate("skill", "new-skill")).toContain("name: new-skill");
  });
});
