// @effect-diagnostics nodeBuiltinImport:off - the logs are real files in a temp folder.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { makeWith, type LogReader } from "./SkillUsage.ts";
import { foldUsage, skillUsesInLine } from "./skillUsageCore.ts";

const use = (skill: string, timestamp: string) =>
  JSON.stringify({
    type: "assistant",
    timestamp,
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] },
  });

describe("SkillUsage", () => {
  let projects = "";
  let reads: Array<string> = [];
  let failNext = new Set<string>();

  // Same parsing as the real reader, without the stream, so reads can be counted.
  const reader: LogReader = async (file) => {
    reads.push(NodePath.basename(file));
    if (failNext.delete(file)) throw new Error("EIO");
    const text = await NodeFSP.readFile(file, "utf8");
    return foldUsage(text.split("\n").flatMap(skillUsesInLine));
  };
  const service = () => makeWith({ projectsDir: () => projects, readLog: reader });
  const names = (result: { readonly skills: ReadonlyArray<{ readonly name: string }> }) =>
    result.skills.map((skill) => skill.name);

  beforeEach(async () => {
    reads = [];
    failNext = new Set();
    projects = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "skill-usage-"));
    const nested = NodePath.join(projects, "-home-me-app", "session", "subagents");
    await NodeFSP.mkdir(nested, { recursive: true });
    await NodeFSP.writeFile(
      NodePath.join(projects, "-home-me-app", "a.jsonl"),
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
    await NodeFSP.rm(projects, { recursive: true, force: true });
  });

  it.effect("merges every log under projects, subagent logs included", () =>
    Effect.gen(function* () {
      const usage = yield* service();
      const result = yield* usage.list({ scan: true });
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
      const usage = yield* service();
      expect(yield* usage.list({})).toEqual({
        homePath: NodeOS.homedir(),
        scanned: false,
        skills: [],
      });
      expect(reads).toEqual([]);
    }),
  );

  it.effect("does not re-read an unchanged log, and picks up one that grew", () =>
    Effect.gen(function* () {
      const usage = yield* service();
      yield* usage.list({ scan: true });
      expect(reads.toSorted()).toEqual(["a.jsonl", "agent-1.jsonl"]);
      reads.length = 0;
      yield* usage.list({ scan: true });
      expect(reads).toEqual([]);

      yield* Effect.promise(() =>
        NodeFSP.appendFile(
          NodePath.join(projects, "-home-me-app", "a.jsonl"),
          `\n${use("designer", "2026-10-20T10:00:00.000Z")}`,
        ),
      );
      const result = yield* usage.list({ scan: true });
      expect(reads).toEqual(["a.jsonl"]);
      expect(names(result)).toEqual(["designer", "tdd", "clarify"]);
    }),
  );

  it.effect("forgets a log that was deleted", () =>
    Effect.gen(function* () {
      const usage = yield* service();
      yield* usage.list({ scan: true });
      yield* Effect.promise(() => NodeFSP.rm(NodePath.join(projects, "-home-me-app", "a.jsonl")));
      const result = yield* usage.list({ scan: true });
      expect(result.skills).toEqual([
        { name: "tdd", lastUsedAt: "2026-10-09T10:00:00.000Z", uses: 1 },
      ]);
    }),
  );

  it.effect("tries a log again after a failed read instead of caching it as empty", () =>
    Effect.gen(function* () {
      const usage = yield* service();
      failNext.add(NodePath.join(projects, "-home-me-app", "a.jsonl"));
      expect(names(yield* usage.list({ scan: true }))).toEqual(["tdd"]);
      expect(names(yield* usage.list({ scan: true }))).toEqual(["tdd", "clarify"]);
    }),
  );

  it.effect("shares one scan between overlapping calls", () =>
    Effect.gen(function* () {
      const usage = yield* service();
      const [first, second] = yield* Effect.all(
        [usage.list({ scan: true }), usage.list({ scan: true })],
        { concurrency: 2 },
      );
      expect(first.skills).toEqual(second.skills);
      expect(reads.toSorted()).toEqual(["a.jsonl", "agent-1.jsonl"]);
    }),
  );
});
