import type { CustomizationItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  buildCuratorBrief,
  buildKitMcp,
  buildKitSkills,
  categorise,
  detectSource,
  displayUserText,
  estimateContext,
  groupByCategory,
  parseHooks,
  parsePlugins,
  pickCuratorProject,
  sourceCounts,
} from "./kitModel";

const skill = (
  name: string,
  path: string,
  extra: Partial<CustomizationItem> = {},
): CustomizationItem => ({
  kind: "skill",
  name,
  path,
  scope: "user",
  readOnly: false,
  harness: "claude",
  ...extra,
});

describe("detectSource", () => {
  it("reads the pack from the path", () => {
    expect(detectSource({ name: "qa", path: "/h/.claude/skills/gstack/qa/SKILL.md" })).toBe(
      "gstack",
    );
    expect(
      detectSource({ name: "council", path: "/h/.claude/skills/tstack/council/SKILL.md" }),
    ).toBe("tstack");
  });

  it("falls back to the known pack names, then to mine", () => {
    expect(detectSource({ name: "tdd", path: "/h/.claude/skills/tdd/SKILL.md" })).toBe("matt");
    expect(detectSource({ name: "pdf", path: "/h/.claude/skills/pdf/SKILL.md" })).toBe("anth");
    expect(detectSource({ name: "fh-saas", path: "/h/.claude/skills/fh-saas/SKILL.md" })).toBe(
      "mine",
    );
  });
});

describe("categorise", () => {
  it("prefers the name over the description", () => {
    expect(categorise("diagnosing-bugs", "Review everything")).toBe("debug");
    expect(categorise("tdd", "Red, green, refactor")).toBe("build");
  });

  it("uses the description when the name says nothing", () => {
    expect(categorise("cso", "OWASP Top 10 audit")).toBe("security");
    expect(categorise("zzz", "Nothing to see")).toBe("other");
  });
});

describe("buildKitSkills", () => {
  it("merges a skill both agents have and keeps the Claude path", () => {
    const skills = buildKitSkills([
      skill("tdd", "/h/.codex/skills/tdd/SKILL.md", { harness: "codex" }),
      skill("tdd", "/h/.claude/skills/tdd/SKILL.md"),
      skill("agent-x", "/h/.claude/agents/x.md", { kind: "agent" }),
    ]);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({
      name: "tdd",
      path: "/h/.claude/skills/tdd/SKILL.md",
      harnesses: ["claude", "codex"],
      source: "matt",
    });
  });
});

describe("sourceCounts and groupByCategory", () => {
  const skills = buildKitSkills([
    skill("tdd", "/a/tdd/SKILL.md"),
    skill("qa", "/a/gstack/qa/SKILL.md"),
    skill("review", "/a/gstack/review/SKILL.md"),
  ]);

  it("counts in-kit against each pack's total", () => {
    const counts = sourceCounts(skills);
    expect(counts.find((c) => c.id === "gstack")).toEqual({ id: "gstack", inKit: 2, total: 31 });
    expect(counts.find((c) => c.id === "mine")).toEqual({ id: "mine", inKit: 0, total: 0 });
  });

  it("groups by category and filters to one", () => {
    expect(groupByCategory(skills, null).map((g) => [g.label, g.skills.length])).toEqual([
      ["Build", 1],
      ["Review", 1],
      ["Test & QA", 1],
    ]);
    expect(groupByCategory(skills, "review").map((g) => g.skills[0]?.name)).toEqual(["review"]);
  });
});

describe("buildKitMcp", () => {
  it("makes one row per server with its agents and leaves out Codex's config.toml", () => {
    const rows = buildKitMcp([
      { kind: "mcp", name: "github", path: "/h/.claude.json", scope: "user", readOnly: true },
      {
        kind: "mcp",
        name: "github",
        path: "/w/.mcp.json",
        scope: "workspace",
        readOnly: false,
        harness: "codex",
      },
      {
        kind: "mcp",
        name: "config.toml",
        path: "/h/.codex/config.toml",
        scope: "user",
        readOnly: true,
        harness: "codex",
      },
    ]);
    expect(rows).toEqual([
      {
        name: "github",
        agents: ["claude", "codex"],
        scopes: ["user", "workspace"],
        paths: ["/h/.claude.json", "/w/.mcp.json"],
      },
    ]);
  });
});

describe("estimateContext", () => {
  it("prices skills by text length and MCP servers at a flat guess", () => {
    const skills = buildKitSkills([skill("abcd", "/a/SKILL.md", { description: "x".repeat(76) })]);
    expect(estimateContext(skills, 2)).toEqual({ skillsK: 0.04, mcpK: 3, totalK: 3.04 });
  });
});

describe("parseHooks", () => {
  it("turns settings hooks into event sentences", () => {
    const text = JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "careful.sh" }] }],
        Stop: [{ hooks: [{ type: "command", command: "say done" }] }],
        Notification: [{ hooks: [{ type: "command", command: "notify" }] }],
      },
    });
    expect(parseHooks(text)).toEqual([
      { event: "before", eventName: "PreToolUse", matcher: "Bash", command: "careful.sh" },
      { event: "stop", eventName: "Stop", matcher: "", command: "say done" },
      { event: "other", eventName: "Notification", matcher: "", command: "notify" },
    ]);
  });

  it("returns nothing for broken or hook-less settings", () => {
    expect(parseHooks("{nope")).toEqual([]);
    expect(parseHooks("{}")).toEqual([]);
  });
});

describe("parsePlugins", () => {
  it("lists enabled plugins first with their marketplace", () => {
    expect(
      parsePlugins(JSON.stringify({ enabledPlugins: { "b@mk": false, "a@mk": true } })),
    ).toEqual([
      { name: "a", marketplace: "mk", enabled: true },
      { name: "b", marketplace: "mk", enabled: false },
    ]);
  });
});

describe("pickCuratorProject", () => {
  it("prefers the home folder, then the first project", () => {
    const projects = [{ workspaceRoot: "/home/ab/code/app" }, { workspaceRoot: "/home/ab" }];
    expect(pickCuratorProject(projects)?.workspaceRoot).toBe("/home/ab");
    expect(pickCuratorProject(projects.slice(0, 1))?.workspaceRoot).toBe("/home/ab/code/app");
    expect(pickCuratorProject([])).toBeNull();
  });
});

describe("curator brief", () => {
  it("keeps the person's request recoverable from the first message", () => {
    const skills = buildKitSkills([skill("tdd", "/a/tdd/SKILL.md")]);
    const brief = buildCuratorBrief({ skills, mcpServers: 1, request: "drop duplicates" });
    expect(brief).toContain("My kit now: 1 skills (Matt Pocock 1) and 1 MCP servers.");
    expect(displayUserText(brief)).toBe("drop duplicates");
    expect(displayUserText("plain follow-up")).toBe("plain follow-up");
  });
});
