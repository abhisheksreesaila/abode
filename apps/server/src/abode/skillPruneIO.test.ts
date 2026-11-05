// @effect-diagnostics nodeBuiltinImport:off - the prune moves real folders and links in a temp HOME.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { cutSkills, listTrash, restoreSkills } from "./skillPruneIO.ts";

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

  it("cuts a skill held by three roots and restores all three copies", async () => {
    const { claude, agents, codex, dirs, skill, link } = setup();
    skill(agents, "tdd");
    link(NodePath.join(agents, "tdd"), NodePath.join(claude, "tdd"));
    link(NodePath.join(agents, "tdd"), NodePath.join(codex, "tdd"));

    expect((await cutSkills(dirs, ["tdd"], 6_000)).done).toEqual(["tdd"]);
    for (const dir of dirs) expect(exists(NodePath.join(dir, "tdd"))).toBe(false);
    expect(await listTrash(dirs)).toEqual({
      entries: [
        {
          name: "tdd",
          movedAt: 6_000,
          paths: [
            NodePath.join(claude, "tdd"),
            NodePath.join(codex, "tdd"),
            NodePath.join(agents, "tdd"),
          ],
        },
      ],
    });

    expect((await restoreSkills(dirs, ["tdd"])).done).toEqual(["tdd"]);
    expect(NodeFS.lstatSync(NodePath.join(codex, "tdd")).isSymbolicLink()).toBe(true);
    expect(NodeFS.readFileSync(NodePath.join(codex, "tdd", "SKILL.md"), "utf8")).toContain(
      "body tdd",
    );
    expect((await listTrash(dirs)).entries).toEqual([]);
  });

  it("restores the latest cut of a name first when it was cut twice", async () => {
    const { claude, dirs } = setup();
    const write = (text: string) => {
      NodeFS.mkdirSync(NodePath.join(claude, "docs"), { recursive: true });
      NodeFS.writeFileSync(NodePath.join(claude, "docs", "SKILL.md"), text);
    };
    write("first");
    await cutSkills(dirs, ["docs"], 7_000);
    write("second");
    await cutSkills(dirs, ["docs"], 8_000);

    await restoreSkills(dirs, ["docs"]);
    expect(NodeFS.readFileSync(NodePath.join(claude, "docs", "SKILL.md"), "utf8")).toBe("second");
    NodeFS.rmSync(NodePath.join(claude, "docs"), { recursive: true });
    await restoreSkills(dirs, ["docs"]);
    expect(NodeFS.readFileSync(NodePath.join(claude, "docs", "SKILL.md"), "utf8")).toBe("first");
  });

  it("puts the link back when the folder of the same skill cannot be moved", async () => {
    const { claude, agents, dirs, skill, link } = setup();
    skill(agents, "tdd");
    link(NodePath.join(agents, "tdd"), NodePath.join(claude, "tdd"));
    NodeFS.chmodSync(agents, 0o555);
    const result = await cutSkills(dirs, ["tdd"], 9_000);
    NodeFS.chmodSync(agents, 0o755);

    expect(result.done).toEqual([]);
    expect(result.skipped[0]?.reason).toContain("could not move it");
    expect(NodeFS.lstatSync(NodePath.join(claude, "tdd")).isSymbolicLink()).toBe(true);
    expect(exists(NodePath.join(agents, "tdd", "SKILL.md"))).toBe(true);
    expect(NodeFS.readdirSync(NodePath.join(claude, ".trash"))).toEqual([]);
  });

  it("puts the folder back in the trash when the link cannot be restored", async () => {
    const { claude, agents, dirs, skill, link } = setup();
    skill(agents, "tdd");
    link(NodePath.join(agents, "tdd"), NodePath.join(claude, "tdd"));
    await cutSkills(dirs, ["tdd"], 10_000);
    NodeFS.chmodSync(claude, 0o555);
    const result = await restoreSkills(dirs, ["tdd"]);
    NodeFS.chmodSync(claude, 0o755);

    expect(result.done).toEqual([]);
    expect(exists(NodePath.join(agents, "tdd"))).toBe(false);
    expect((await listTrash(dirs)).entries).toHaveLength(1);
    expect((await restoreSkills(dirs, ["tdd"])).done).toEqual(["tdd"]);
  });

  it("refuses to restore over an empty folder that appeared meanwhile", async () => {
    const { claude, dirs, skill } = setup();
    skill(claude, "docs");
    await cutSkills(dirs, ["docs"], 11_000);
    NodeFS.mkdirSync(NodePath.join(claude, "docs"));
    expect((await restoreSkills(dirs, ["docs"])).skipped[0]?.reason).toBe(
      "something is already there",
    );
  });

  it("does not trust a tampered index", async () => {
    const { home, claude, dirs, skill } = setup();
    skill(claude, "docs");
    await cutSkills(dirs, ["docs"], 12_000);
    const index = NodePath.join(claude, ".trash", "index.json");
    const real = JSON.parse(NodeFS.readFileSync(index, "utf8"));
    const entry = real.entries[0];
    for (const bad of [
      { ...entry, items: [{ dir: NodePath.join(home, "elsewhere"), slot: "0" }] },
      { ...entry, items: [{ dir: claude, slot: "../x" }] },
      { ...entry, id: ".." },
      { ...entry, name: "../docs" },
    ]) {
      NodeFS.writeFileSync(index, JSON.stringify({ version: 1, entries: [bad] }));
      const result = await restoreSkills(dirs, [bad.name]);
      expect(result.done).toEqual([]);
      expect(exists(NodePath.join(claude, "docs"))).toBe(false);
    }
    expect((await listTrash(dirs)).entries).toEqual([]);
  });

  it("moves a corrupt index aside and refuses instead of treating it as empty", async () => {
    const { claude, dirs, skill } = setup();
    skill(claude, "docs");
    skill(claude, "other");
    await cutSkills(dirs, ["docs"], 13_000);
    NodeFS.writeFileSync(NodePath.join(claude, ".trash", "index.json"), "{not json");

    const result = await cutSkills(dirs, ["other"], 14_000);
    expect(result.done).toEqual([]);
    expect(result.skipped[0]?.reason).toContain("moved aside to index.json.bad-14000");
    expect(exists(NodePath.join(claude, "other", "SKILL.md"))).toBe(true);
    expect(exists(NodePath.join(claude, ".trash", "index.json.bad-14000"))).toBe(true);
  });

  it("refuses a trash folder that is a link", async () => {
    const { home, claude, dirs, skill, link } = setup();
    skill(claude, "docs");
    const elsewhere = NodePath.join(home, "elsewhere");
    NodeFS.mkdirSync(elsewhere);
    link(elsewhere, NodePath.join(claude, ".trash"));
    const result = await cutSkills(dirs, ["docs"], 15_000);
    expect(result.done).toEqual([]);
    expect(result.skipped[0]?.reason).toContain("is a link");
    expect(exists(NodePath.join(claude, "docs", "SKILL.md"))).toBe(true);
    expect(NodeFS.readdirSync(elsewhere)).toEqual([]);
  });
});
