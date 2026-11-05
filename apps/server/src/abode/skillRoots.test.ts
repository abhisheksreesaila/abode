// @effect-diagnostics nodeBuiltinImport:off - cut and restore run against real temp folders.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it, vi } from "vite-plus/test";

import { cutSkills, restoreSkills } from "./skillPruneIO.ts";
import { defaultLocalSkillDirs } from "./skillSourcesIO.ts";
import { agentsHomeDir, claudeConfigDir, codexHomeDir, skillRootDirs } from "./skillRoots.ts";

describe("skill roots follow the environment overrides", () => {
  const base = NodeFS.realpathSync(NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "roots-")));
  const env = {
    CLAUDE_CONFIG_DIR: NodePath.join(base, "c"),
    AGENTS_HOME: NodePath.join(base, "a"),
    CODEX_HOME: NodePath.join(base, "x"),
  };

  it("resolves each agent folder from its variable, else from the home folder", () => {
    expect(claudeConfigDir(env, "/h")).toBe(env.CLAUDE_CONFIG_DIR);
    expect(agentsHomeDir(env, "/h")).toBe(env.AGENTS_HOME);
    expect(codexHomeDir(env, "/h")).toBe(env.CODEX_HOME);
    expect(skillRootDirs({}, "/h")).toEqual([
      "/h/.claude/skills",
      "/h/.agents/skills",
      "/h/.codex/skills",
    ]);
  });

  it("cuts and restores in the overridden folders, with the trash under the Claude one", async () => {
    const dirs = skillRootDirs(env, "/nowhere");
    expect(dirs).toEqual([
      NodePath.join(base, "c", "skills"),
      NodePath.join(base, "a", "skills"),
      NodePath.join(base, "x", "skills"),
    ]);
    for (const dir of dirs) NodeFS.mkdirSync(dir, { recursive: true });
    NodeFS.mkdirSync(NodePath.join(dirs[1]!, "tdd"));
    NodeFS.writeFileSync(NodePath.join(dirs[1]!, "tdd", "SKILL.md"), "body");
    NodeFS.symlinkSync(NodePath.join(dirs[1]!, "tdd"), NodePath.join(dirs[0]!, "tdd"));

    expect((await cutSkills(dirs, ["tdd"], 1)).done).toEqual(["tdd"]);
    expect(NodeFS.existsSync(NodePath.join(dirs[0]!, ".trash", "index.json"))).toBe(true);
    expect(NodeFS.existsSync(NodePath.join(dirs[1]!, "tdd"))).toBe(false);
    expect((await restoreSkills(dirs, ["tdd"], 2)).done).toEqual(["tdd"]);
    expect(NodeFS.readFileSync(NodePath.join(dirs[0]!, "tdd", "SKILL.md"), "utf8")).toBe("body");
  });

  it("hands the installer and the service the same overridden folders", () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", env.CLAUDE_CONFIG_DIR);
    vi.stubEnv("AGENTS_HOME", env.AGENTS_HOME);
    vi.stubEnv("CODEX_HOME", env.CODEX_HOME);
    expect(defaultLocalSkillDirs()).toEqual(skillRootDirs(env));
    vi.unstubAllEnvs();
  });
});
