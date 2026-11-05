import type { SkillChange, SkillSourceStatus } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  groupChanges,
  kitFeedText,
  mergePrompt,
  overlapHint,
  pendingCount,
  sourceSummary,
  takeAllTitle,
  updatesFooter,
} from "./updatesModel";

const change = (over: Partial<SkillChange> & { name: string }): SkillChange => ({
  kind: "new",
  key: `skills/${over.name}`,
  description: "",
  tokens: 40,
  local: "none",
  ...over,
});

const source = (over: Partial<SkillSourceStatus> & { id: string }): SkillSourceStatus => ({
  name: over.id,
  supported: true,
  skillCount: 3,
  changes: [],
  decisions: [],
  ...over,
});

describe("overlapHint", () => {
  const kit = [
    { name: "grilling", description: "Interview the user about a plan." },
    {
      name: "tdd",
      description: "Test-driven development: write a failing test, make it pass, refactor.",
    },
    { name: "wizard", description: "Interactive bash wizard for human-only steps." },
  ];

  it("names a kit skill with the same name", () => {
    expect(overlapHint({ name: "TDD", description: "x" }, kit)).toBe("tdd");
  });

  it("matches a shared word of the name across forms", () => {
    expect(overlapHint({ name: "grill-me", description: "Quiz yourself." }, kit)).toBe("grilling");
  });

  it("matches four shared distinctive words of the description", () => {
    expect(
      overlapHint(
        {
          name: "red-green",
          description: "Write a failing test, then make the test pass and refactor development.",
        },
        kit,
      ),
    ).toBe("tdd");
  });

  it("says nothing for unrelated skills", () => {
    expect(
      overlapHint({ name: "pdf", description: "Merge and split PDF documents." }, kit),
    ).toBeNull();
  });
});

describe("groupChanges", () => {
  it("keeps edited skills out of Take all and new skills out of both lists", () => {
    const groups = groupChanges([
      change({ name: "a", kind: "new" }),
      change({ name: "b", kind: "updated", local: "outdated" }),
      change({ name: "c", kind: "updated", local: "edited" }),
      change({ name: "d", kind: "removed", local: "same" }),
    ]);
    expect(groups.fresh.map((c) => c.name)).toEqual(["a"]);
    expect(groups.takeAll.map((c) => c.name)).toEqual(["b", "d"]);
    expect(groups.edited.map((c) => c.name)).toEqual(["c"]);
  });
});

describe("feed text, counts and footer", () => {
  it("writes one line per source", () => {
    expect(kitFeedText("Matt Pocock", [{ kind: "new" }, { kind: "new" }, { kind: "new" }])).toBe(
      "Matt Pocock added 3 skills",
    );
    expect(kitFeedText("gstack", [{ kind: "new" }, { kind: "updated" }, { kind: "updated" }])).toBe(
      "gstack added 1 skill, updated 2",
    );
  });

  it("counts every pending change, and none before the first read", () => {
    expect(pendingCount(null)).toBe(0);
    expect(
      pendingCount({
        checking: false,
        sources: [
          source({ id: "a", changes: [change({ name: "x" }), change({ name: "y" })] }),
          source({ id: "b", changes: [change({ name: "z" })] }),
        ],
      }),
    ).toBe(3);
  });

  it("lists quiet sources and counts skipped skills once", () => {
    const skip = (key: string) => ({
      key,
      name: key,
      decision: "skip" as const,
      takeAll: false,
      decidedAt: "2026-11-02T10:00:00.000Z",
    });
    const footer = updatesFooter({
      checking: false,
      sources: [
        source({ id: "matt", name: "Matt Pocock", decisions: [skip("a"), skip("a"), skip("b")] }),
        source({ id: "gstack", name: "gstack", changes: [change({ name: "n" })] }),
        source({ id: "pstack", name: "pstack", failure: "check failed: HTTP 500" }),
        source({ id: "tstack", name: "tstack", supported: false }),
      ],
    });
    expect(footer).toEqual({ quiet: ["Matt Pocock"], skipped: 2 });
  });

  it("summarises a source by its last decision, else its last check", () => {
    const changes = [change({ name: "x" }), change({ name: "y" })];
    expect(sourceSummary(source({ id: "a", changes, lastOkAt: "2026-11-04T12:00:00.000Z" }))).toBe(
      "2 changes · checked Nov 4",
    );
    expect(
      sourceSummary(
        source({
          id: "a",
          changes: [change({ name: "x" })],
          decisions: [
            {
              key: "k",
              name: "k",
              decision: "inherit",
              takeAll: false,
              decidedAt: "2026-11-02T12:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe("1 change since Nov 2");
  });
});

describe("mergePrompt", () => {
  const base = {
    sourceName: "Matt Pocock",
    repo: "mattpocock/skills",
    change: { key: "skills/tdd", name: "tdd" },
  };

  it("names the source repo, the skill path and the real local path when known", () => {
    const prompt = mergePrompt({ ...base, localPath: "/home/a/.agents/skills/tdd/SKILL.md" });
    expect(prompt).toContain("mattpocock/skills");
    expect(prompt).toContain("`skills/tdd`");
    expect(prompt).toContain("`/home/a/.agents/skills/tdd/SKILL.md`");
  });

  it("points at the skill roots when the local path is not known", () => {
    expect(mergePrompt(base)).toContain(
      "the installed copy (check ~/.claude/skills, ~/.agents/skills, ~/.codex/skills)",
    );
  });
});

describe("takeAllTitle", () => {
  it("counts updated and removed items separately", () => {
    expect(takeAllTitle([{ kind: "updated" }, { kind: "updated" }, { kind: "removed" }])).toBe(
      "2 updated · 1 removed upstream",
    );
    expect(takeAllTitle([{ kind: "removed" }])).toBe("1 removed upstream");
    expect(takeAllTitle([{ kind: "updated" }])).toBe("1 updated");
  });
});
