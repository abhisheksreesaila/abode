import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { list } from "./SkillUsage.ts";

const use = (skill: string, timestamp: string) =>
  JSON.stringify({
    type: "assistant",
    timestamp,
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
  });

describe("SkillUsage.list", () => {
  let configDir = "";
  let previous: string | undefined;

  beforeEach(async () => {
    previous = process.env.CLAUDE_CONFIG_DIR;
    configDir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "skill-usage-"));
    process.env.CLAUDE_CONFIG_DIR = configDir;
    const nested = NodePath.join(configDir, "projects", "-home-me-app", "session", "subagents");
    await NodeFSP.mkdir(nested, { recursive: true });
    await NodeFSP.writeFile(
      NodePath.join(configDir, "projects", "-home-me-app", "a.jsonl"),
      [
        use("tdd", "2026-10-01T10:00:00.000Z"),
        "not json",
        use("clarify", "2026-10-02T10:00:00.000Z"),
      ].join("\n"),
    );
    await NodeFSP.writeFile(
      NodePath.join(nested, "agent-1.jsonl"),
      use("tdd", "2026-10-09T10:00:00.000Z"),
    );
  });

  afterEach(async () => {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = previous;
    await NodeFSP.rm(configDir, { recursive: true, force: true });
  });

  it.effect("merges every log under projects, subagent logs included", () =>
    Effect.gen(function* () {
      const result = yield* list({ scan: true });
      expect(result.scanned).toBe(true);
      expect(result.homePath).toBe(NodeOS.homedir());
      expect(result.skills).toEqual([
        { name: "tdd", lastUsedAt: "2026-10-09T10:00:00.000Z", uses: 2 },
        { name: "clarify", lastUsedAt: "2026-10-02T10:00:00.000Z", uses: 1 },
      ]);
    }),
  );

  it.effect("returns only the home path, without reading logs, when scan is off", () =>
    Effect.gen(function* () {
      const result = yield* list({});
      expect(result).toEqual({ homePath: NodeOS.homedir(), scanned: false, skills: [] });
    }),
  );
});
