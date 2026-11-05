// @effect-diagnostics nodeBuiltinImport:off - the prune moves real folders and links in a temp HOME.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { cutSkills, restoreSkills } from "./skillPruneIO.ts";

const setup = () => {
  const home = NodeFS.realpathSync(NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "prune-")));
  const claude = NodePath.join(home, ".claude", "skills");
  const agents = NodePath.join(home, ".agents", "skills");
  const codex = NodePath.join(home, ".codex", "skills");
  for (const dir of [claude, agents, codex]) NodeFS.mkdirSync(dir, { recursive: true });
  const dirs = [claude, agents, codex];
  const skill = (dir: string, name: string) => {
    NodeFS.mkdirSync(NodePath.join(dir, name), { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(dir, name, "SKILL.md"),
      `---\nname: ${name}\n---\nbody ${name}`,
    );
  };
  const link = (target: string, at: string) => NodeFS.symlinkSync(target, at);
  return { home, claude, agents, codex, dirs, skill, link };
};

const exists = (path: string) => {
  try {
    NodeFS.lstatSync(path);
    return true;
  } catch {
    return false;
  }
};

describe("cutSkills / restoreSkills", () => {
  it("moves a real skill folder to the trash and restores it where it was", async () => {
    const { claude, dirs, skill } = setup();
    skill(claude, "docs");
    const cut = await cutSkills(dirs, ["docs"], 1_000);
    expect(cut).toEqual({ done: ["docs"], skipped: [] });
    expect(exists(NodePath.join(claude, "docs"))).toBe(false);
    expect(NodeFS.readdirSync(NodePath.join(claude, ".trash")).toSorted()).toEqual([
      "docs-1000",
      "index.json",
    ]);

    const back = await restoreSkills(dirs, ["docs"]);
    expect(back).toEqual({ done: ["docs"], skipped: [] });
    expect(NodeFS.readFileSync(NodePath.join(claude, "docs", "SKILL.md"), "utf8")).toContain(
      "body docs",
    );
    expect(NodeFS.readdirSync(NodePath.join(claude, ".trash"))).toEqual(["index.json"]);
  });

  it("moves a symlinked skill as a link and leaves its target alone", async () => {
    const { claude, agents, dirs, skill, link } = setup();
    skill(agents, "tdd");
    link(NodePath.join(agents, "tdd"), NodePath.join(claude, "tdd"));

    const cut = await cutSkills(dirs, ["tdd"], 2_000);
    expect(cut.done).toEqual(["tdd"]);
    // Both the claude link and the agents folder are gone from the roots, the folder is kept whole.
    expect(exists(NodePath.join(claude, "tdd"))).toBe(false);
    expect(exists(NodePath.join(agents, "tdd"))).toBe(false);
    const trashed = NodePath.join(claude, ".trash", "tdd-2000");
    const kinds = NodeFS.readdirSync(trashed).map((slot) =>
      NodeFS.lstatSync(NodePath.join(trashed, slot)).isSymbolicLink() ? "link" : "folder",
    );
    expect(kinds.toSorted()).toEqual(["folder", "link"]);

    const back = await restoreSkills(dirs, ["tdd"]);
    expect(back.done).toEqual(["tdd"]);
    expect(NodeFS.lstatSync(NodePath.join(claude, "tdd")).isSymbolicLink()).toBe(true);
    expect(NodeFS.readlinkSync(NodePath.join(claude, "tdd"))).toBe(NodePath.join(agents, "tdd"));
    expect(NodeFS.readFileSync(NodePath.join(claude, "tdd", "SKILL.md"), "utf8")).toContain(
      "body tdd",
    );
  });

  it("cuts only the link when the target is outside every root's own copy", async () => {
    const { home, claude, dirs, link } = setup();
    const outside = NodePath.join(home, "elsewhere", "far");
    NodeFS.mkdirSync(outside, { recursive: true });
    NodeFS.writeFileSync(NodePath.join(outside, "SKILL.md"), "---\nname: far\n---\n");
    link(outside, NodePath.join(claude, "far"));

    expect(await cutSkills(dirs, ["far"], 3_000)).toEqual({
      done: [],
      skipped: [{ name: "far", reason: "lives outside your skill folders" }],
    });
    expect(exists(NodePath.join(claude, "far"))).toBe(true);
    expect(exists(NodePath.join(outside, "SKILL.md"))).toBe(true);
  });

  it("refuses to restore over something that now occupies the path", async () => {
    const { claude, dirs, skill } = setup();
    skill(claude, "docs");
    await cutSkills(dirs, ["docs"], 4_000);
    skill(claude, "docs");

    expect(await restoreSkills(dirs, ["docs"])).toEqual({
      done: [],
      skipped: [{ name: "docs", reason: "something is already there" }],
    });
    // The trashed copy is kept so a later restore still works.
    expect(exists(NodePath.join(claude, ".trash", "docs-4000"))).toBe(true);
  });

  it("rejects names that could escape a root, and names that are not skills", async () => {
    const { claude, dirs, skill } = setup();
    skill(claude, "real");
    NodeFS.mkdirSync(NodePath.join(claude, "plain"));
    const result = await cutSkills(dirs, ["../x", "a/b", ".trash", "ghost", "plain"], 5_000);
    expect(result).toEqual({
      done: [],
      skipped: [
        { name: "../x", reason: "not a skill name" },
        { name: "a/b", reason: "not a skill name" },
        { name: ".trash", reason: "not a skill name" },
        { name: "ghost", reason: "not in your kit" },
        { name: "plain", reason: "not in your kit" },
      ],
    });
    expect(exists(NodePath.join(claude, "real", "SKILL.md"))).toBe(true);
  });

  it("says so when there is nothing to restore", async () => {
    const { dirs } = setup();
    expect(await restoreSkills(dirs, ["docs"])).toEqual({
      done: [],
      skipped: [{ name: "docs", reason: "nothing in the trash by that name" }],
    });
  });
});
