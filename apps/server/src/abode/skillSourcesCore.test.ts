// @effect-diagnostics globalDate:off - the 06:00 rule is local time.
import { describe, expect, it } from "@effect/vitest";

import {
  STARTUP_CHECK_DELAY_MS,
  classifyLocal,
  diffSnapshots,
  estimateTokens,
  findSkills,
  folderHash,
  gitBlobSha,
  msUntilNextCheck,
  parseSkillMd,
  withKnownHash,
  worstLocalState,
  type Snapshot,
  type SnapshotSkill,
  type TreeEntry,
} from "./skillSourcesCore.ts";

const blob = (path: string, sha = `sha-${path}`): TreeEntry => ({ path, type: "blob", sha });

const skill = (key: string, hash: string, extra: Partial<SnapshotSkill> = {}): SnapshotSkill => ({
  key,
  name: key.split("/").at(-1) ?? key,
  description: `${key} does a thing`,
  tokens: 30,
  hash,
  files: ["SKILL.md"],
  knownHashes: [hash],
  ...extra,
});

const snapshot = (...skills: SnapshotSkill[]): Snapshot =>
  Object.fromEntries(skills.map((s) => [s.key, s]));

describe("gitBlobSha", () => {
  it("matches what git gives the same bytes", () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(gitBlobSha(new TextEncoder().encode("hello\n"))).toBe(
      "ce013625030ba8dba906f756967f9e9ca394464a",
    );
  });
});

describe("findSkills", () => {
  const tree: TreeEntry[] = [
    { path: "skills", type: "tree", sha: "t" },
    blob("skills/tdd/SKILL.md"),
    blob("skills/tdd/examples/a.md"),
    blob("skills/pr/SKILL.md"),
    blob("skills/pr/.hidden/SKILL.md"),
    blob("skills/node_modules/x/SKILL.md"),
    blob("README.md"),
    blob("skills/tdd/nested/SKILL.md"),
  ];

  it("finds each folder with a SKILL.md and its files, and keeps nested skills apart", () => {
    const found = findSkills(tree, { rootName: "repo" });
    expect(found.map((s) => [s.key, s.name, s.files.map((f) => f.path)])).toEqual([
      ["skills/pr", "pr", ["SKILL.md"]],
      ["skills/tdd", "tdd", ["SKILL.md", "examples/a.md"]],
      ["skills/tdd/nested", "nested", ["SKILL.md"]],
    ]);
  });

  it("names a root SKILL.md after the repo and counts only that file", () => {
    const found = findSkills([blob("SKILL.md"), blob("setup"), blob("qa/SKILL.md")], {
      rootName: "gstack",
    });
    expect(found.map((s) => [s.key, s.name, s.files.map((f) => f.path)])).toEqual([
      [".", "gstack", ["SKILL.md"]],
      ["qa", "qa", ["SKILL.md"]],
    ]);
  });

  it("only looks under the prefix", () => {
    const found = findSkills([blob("pstack/skills/a/SKILL.md"), blob("other/b/SKILL.md")], {
      prefix: "pstack",
      rootName: "plugins",
    });
    expect(found.map((s) => [s.key, s.name])).toEqual([["pstack/skills/a", "a"]]);
  });
});

describe("parseSkillMd", () => {
  it("reads name and a folded multi-line description", () => {
    const text = "---\nname: tdd\ndescription: >\n  Test-driven\n  development loop.\n---\n# Body";
    expect(parseSkillMd(text)).toEqual({
      name: "tdd",
      description: "Test-driven development loop.",
    });
  });

  it("gives an empty description when there is no front matter", () => {
    expect(parseSkillMd("# Just a body")).toEqual({ description: "" });
  });

  it("estimates tokens like the Kit meter: 20 plus a quarter of the characters", () => {
    expect(estimateTokens("tdd", "a".repeat(37))).toBe(30);
  });
});

describe("diffSnapshots", () => {
  const baseline = snapshot(skill("a", "1"), skill("b", "1"), skill("c", "1"));
  const latest = snapshot(skill("a", "1"), skill("b", "2"), skill("d", "1"));

  it("reports new, updated and removed, in that order", () => {
    expect(diffSnapshots(baseline, latest).map((c) => [c.kind, c.skill.key, c.skill.hash])).toEqual(
      [
        ["new", "d", "1"],
        ["updated", "b", "2"],
        ["removed", "c", "1"],
      ],
    );
  });

  it("reports nothing when the snapshots match", () => {
    expect(diffSnapshots(baseline, baseline)).toEqual([]);
  });
});

describe("local copies", () => {
  const upstream = { hash: "v3", knownHashes: ["v1", "v2", "v3"] };

  it("tells uninstalled, identical, older-upstream and locally edited apart", () => {
    expect(classifyLocal(null, upstream)).toBe("none");
    expect(classifyLocal("v3", upstream)).toBe("same");
    expect(classifyLocal("v1", upstream)).toBe("outdated");
    expect(classifyLocal("mine", upstream)).toBe("edited");
  });

  it("lets an edit in any installed copy block an overwrite", () => {
    expect(worstLocalState(["same", "edited", "outdated"])).toBe("edited");
    expect(worstLocalState(["same", "outdated"])).toBe("outdated");
    expect(worstLocalState([])).toBe("none");
  });

  it("remembers each upstream hash once, newest last", () => {
    const first = withKnownHash(undefined, "v1");
    const second = withKnownHash(skill("a", "v1", { knownHashes: first }), "v2");
    expect(second).toEqual(["v1", "v2"]);
    expect(withKnownHash(skill("a", "v2", { knownHashes: second }), "v2")).toEqual(["v1", "v2"]);
  });

  it("hashes a folder by file names and contents, not by listing order", () => {
    const a = { path: "SKILL.md", sha: "1" };
    const b = { path: "x/y.md", sha: "2" };
    expect(folderHash([a, b])).toBe(folderHash([b, a]));
    expect(folderHash([a, b])).not.toBe(folderHash([a, { ...b, sha: "3" }]));
  });
});

describe("msUntilNextCheck", () => {
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute).getTime();

  it("waits for the next 06:00 when today's check already ran", () => {
    expect(msUntilNextCheck(at(4, 7), at(4, 6, 1))).toBe(23 * 3_600_000);
    expect(msUntilNextCheck(at(4, 5), at(3, 6, 1))).toBe(3_600_000);
  });

  it("checks soon after start when 06:00 passed since the last attempt, or there never was one", () => {
    expect(msUntilNextCheck(at(4, 9), at(3, 6, 1))).toBe(STARTUP_CHECK_DELAY_MS);
    expect(msUntilNextCheck(at(4, 9), null)).toBe(STARTUP_CHECK_DELAY_MS);
  });
});
