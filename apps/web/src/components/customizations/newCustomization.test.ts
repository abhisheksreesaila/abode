import { describe, expect, it } from "vite-plus/test";

import {
  availableScopes,
  coerceScope,
  harnessFromProviderInstance,
  planNewCustomization,
  slugify,
  type NewCustomizationRequest,
} from "./newCustomization";

const CWD = "/work/app/";

function plan(overrides: Partial<NewCustomizationRequest>) {
  return planNewCustomization({
    kind: "skill",
    harness: "claude",
    scope: "workspace",
    name: "Deploy Helper",
    cwd: CWD,
    ...overrides,
  });
}

describe("slugify", () => {
  it("lowercases, dashes and trims", () => {
    expect(slugify("  My Cool Skill! ")).toBe("my-cool-skill");
    expect(slugify("Café_au-lait")).toBe("cafe-au-lait");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });

  it("is empty when nothing usable is left, and capped at 64 characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("a".repeat(100))).toHaveLength(64);
  });
});

describe("planNewCustomization paths", () => {
  it("writes Claude skills and agents under the workspace or ~/.claude", () => {
    expect(plan({})?.path).toBe("/work/app/.claude/skills/deploy-helper/SKILL.md");
    expect(plan({ scope: "user" })?.path).toBe("~/.claude/skills/deploy-helper/SKILL.md");
    expect(plan({ kind: "agent" })?.path).toBe("/work/app/.claude/agents/deploy-helper.md");
    expect(plan({ kind: "agent", scope: "user" })?.path).toBe("~/.claude/agents/deploy-helper.md");
  });

  it("writes Codex skills and prompts under ~/.codex", () => {
    expect(plan({ harness: "codex", scope: "user" })?.path).toBe(
      "~/.codex/skills/deploy-helper/SKILL.md",
    );
    expect(plan({ harness: "codex", scope: "user", kind: "agent" })?.path).toBe(
      "~/.codex/prompts/deploy-helper.md",
    );
  });

  it("targets the fixed instruction and MCP files", () => {
    expect(plan({ kind: "instructions" })?.path).toBe("/work/app/CLAUDE.md");
    expect(plan({ kind: "instructions", scope: "user" })?.path).toBe("~/.claude/CLAUDE.md");
    expect(plan({ kind: "instructions", harness: "codex" })?.path).toBe("/work/app/AGENTS.md");
    expect(plan({ kind: "mcp" })?.path).toBe("/work/app/.mcp.json");
    expect(plan({ kind: "mcp", harness: "codex", scope: "user" })).toMatchObject({
      path: "~/.codex/config.toml",
      readOnly: true,
    });
  });

  it("needs a usable name for skills and agents only", () => {
    expect(plan({ name: "  " })).toBeNull();
    expect(plan({ kind: "agent", name: "***" })).toBeNull();
    expect(plan({ kind: "mcp", name: "" })).not.toBeNull();
    expect(plan({ kind: "instructions", name: "" })).not.toBeNull();
  });

  it("never lets the name escape its folder", () => {
    expect(plan({ name: "../../x" })?.path).toBe("/work/app/.claude/skills/x/SKILL.md");
  });
});

describe("planNewCustomization templates", () => {
  it("gives a skill the name/description front matter and a title", () => {
    expect(plan({})?.contents).toBe(
      "---\nname: deploy-helper\ndescription: <one line: what it does and when to use it>\n---\n\n# Deploy Helper\n",
    );
    expect(plan({ harness: "codex", scope: "user" })?.contents).toBe(plan({})?.contents);
  });

  it("gives a Claude agent name, description and optional tools and model", () => {
    const contents = plan({ kind: "agent" })?.contents ?? "";
    expect(contents).toContain("name: deploy-helper\n");
    expect(contents).toContain("description: ");
    expect(contents).toContain("# tools: ");
    expect(contents).toContain("# model: ");
  });

  it("gives a Codex prompt description and argument-hint", () => {
    const contents = plan({ harness: "codex", scope: "user", kind: "agent" })?.contents ?? "";
    expect(contents).toMatch(/^---\ndescription: .+\nargument-hint: .+\n---\n/);
  });

  it("starts an MCP file as an empty server list and opens existing instruction files", () => {
    expect(plan({ kind: "mcp" })).toMatchObject({
      contents: '{"mcpServers":{}}\n',
      openIfExists: true,
    });
    expect(plan({ kind: "instructions" })?.openIfExists).toBe(true);
    expect(plan({})?.openIfExists).toBe(false);
  });
});

describe("scopes and harness", () => {
  it("limits scopes per harness and kind", () => {
    expect(availableScopes("skill", "claude")).toEqual(["workspace", "user"]);
    expect(availableScopes("skill", "codex")).toEqual(["user"]);
    expect(availableScopes("instructions", "codex")).toEqual(["workspace"]);
    expect(availableScopes("mcp", "claude")).toEqual(["workspace"]);
    expect(coerceScope("skill", "codex", "workspace")).toBe("user");
    expect(coerceScope("skill", "claude", "user")).toBe("user");
  });

  it("reads the harness from the provider instance", () => {
    expect(harnessFromProviderInstance("codex")).toBe("codex");
    expect(harnessFromProviderInstance("claudeAgent")).toBe("claude");
    expect(harnessFromProviderInstance(undefined)).toBe("claude");
  });
});
