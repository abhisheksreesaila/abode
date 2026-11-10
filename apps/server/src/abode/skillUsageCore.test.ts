import { describe, expect, it } from "@effect/vitest";

import { foldUsage, skillUsesInLine } from "./skillUsageCore.ts";

// Shape copied from a real ~/.claude/projects transcript line (long args trimmed).
const skillLine = (skill: string, timestamp = "2026-10-13T23:31:54.505Z") =>
  JSON.stringify({
    parentUuid: "609d64df",
    type: "assistant",
    timestamp,
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "Loading it." },
        {
          type: "tool_use",
          id: "toolu_01RFrkQPR7dMpjfTw7Y26LEm",
          name: "Skill",
          input: { skill, args: "Web version of the trip pages" },
          caller: { type: "direct" },
        },
      ],
    },
  });

describe("skillUsesInLine", () => {
  it("reads the skill and the time from a Skill tool call", () => {
    expect(skillUsesInLine(skillLine("clarify"))).toEqual([
      { skill: "clarify", at: "2026-10-13T23:31:54.505Z" },
    ]);
  });

  it("drops a plugin prefix and a leading slash", () => {
    expect(skillUsesInLine(skillLine("superpowers:brainstorming"))[0]?.skill).toBe("brainstorming");
    expect(skillUsesInLine(skillLine("/tdd"))[0]?.skill).toBe("tdd");
  });

  it("ignores other tools, user lines, broken JSON and lines without a time", () => {
    const bash = JSON.stringify({
      type: "assistant",
      timestamp: "2026-10-13T23:31:54.505Z",
      message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] },
    });
    const mention = JSON.stringify({
      type: "user",
      timestamp: "2026-10-13T23:31:54.505Z",
      message: { content: 'Use the "name":"Skill" tool' },
    });
    expect(skillUsesInLine(bash)).toEqual([]);
    expect(skillUsesInLine(mention)).toEqual([]);
    expect(skillUsesInLine('{"name":"Skill" truncated')).toEqual([]);
    expect(skillUsesInLine(skillLine("tdd", ""))).toEqual([]);
  });
});

describe("foldUsage", () => {
  it("keeps the latest time and counts every use, most recent first", () => {
    const folded = foldUsage([
      { skill: "tdd", at: "2026-10-01T00:00:00.000Z" },
      { skill: "clarify", at: "2026-10-05T00:00:00.000Z" },
      { skill: "tdd", at: "2026-10-09T00:00:00.000Z" },
      { skill: "tdd", at: "2026-10-03T00:00:00.000Z" },
    ]);
    expect(folded).toEqual([
      { name: "tdd", lastUsedAt: "2026-10-09T00:00:00.000Z", uses: 3 },
      { name: "clarify", lastUsedAt: "2026-10-05T00:00:00.000Z", uses: 1 },
    ]);
  });
});
