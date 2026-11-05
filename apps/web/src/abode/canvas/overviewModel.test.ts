import { describe, expect, it } from "vite-plus/test";

import {
  heroCounts,
  machineColour,
  machineFace,
  milestoneBar,
  overviewMachines,
  statusWord,
  usageMeters,
  type OverviewWorkspace,
} from "./overviewModel";

const ws = (over: Partial<OverviewWorkspace> & { key: string }): OverviewWorkspace => ({
  name: over.key,
  group: "quiet",
  sessions: 0,
  running: 0,
  red: false,
  environmentId: "local",
  ...over,
});

describe("heroCounts", () => {
  it("counts workspaces that need you or are red, and running sessions", () => {
    const list = [
      ws({ key: "a", group: "need", red: true, running: 1 }),
      ws({ key: "b", group: "need", running: 0 }),
      ws({ key: "c", group: "move", running: 3 }),
      ws({ key: "d" }),
    ];
    expect(heroCounts(list)).toEqual({ need: 2, red: 1, running: 4 });
  });
});

describe("overviewMachines", () => {
  const machines = [
    { environmentId: "local", label: "ablearn", isPrimary: true, online: true, cpu: 20 },
    { environmentId: "mini", label: "m4-pro", isPrimary: false, online: true, cpu: 60 },
  ];
  it("sorts rows need, move, quiet per machine and sums running agents", () => {
    const sections = overviewMachines(machines, [
      ws({ key: "q1" }),
      ws({ key: "m1", group: "move", running: 2 }),
      ws({ key: "n1", group: "need", running: 1 }),
      ws({ key: "x", environmentId: "mini", group: "move", running: 4 }),
    ]);
    expect(sections[0]!.rows.map((row) => row.key)).toEqual(["n1", "m1", "q1"]);
    expect(sections[0]!.agents).toBe(3);
    expect(sections[1]!.rows.map((row) => row.key)).toEqual(["x"]);
    expect(sections[1]!.agents).toBe(4);
  });
  it("puts a workspace on an unknown machine in the first section", () => {
    const sections = overviewMachines(machines, [ws({ key: "z", environmentId: "gone" })]);
    expect(sections[0]!.rows.map((row) => row.key)).toEqual(["z"]);
  });
});

const plan = (body: string) => ({ error: null, file: { exists: true, contents: body } });

describe("milestoneBar", () => {
  const text = `## Milestone: One
### X-001: a
- **Status:** done
## Milestone: Two
### X-002: b
- **Status:** doing
## Milestone: Three
### X-003: c
- **Status:** todo
`;
  it("has a segment per milestone and labels the current one", () => {
    expect(milestoneBar(plan(text))).toEqual({
      segments: ["done", "current", "todo"],
      label: "Two",
      done: 1,
      finished: false,
    });
  });
  it("shows the goal when every milestone is done", () => {
    const finished = `Goal: ship it
## Milestone: One
### X-001: a
- **Status:** done
`;
    const bar = milestoneBar(plan(finished));
    expect(bar.finished).toBe(true);
    expect(bar.label).toBe("◎ ship it");
  });
  it("has no segments without a plan", () => {
    expect(milestoneBar({ error: null, file: { exists: false, contents: "" } })).toEqual({
      segments: [],
      label: "no plan",
      done: 0,
      finished: false,
    });
    expect(milestoneBar({ error: null, file: null }).label).toBe("…");
  });
});

describe("statusWord", () => {
  it("names red before need before moving", () => {
    expect(statusWord(ws({ key: "a", group: "need", red: true }))).toEqual({
      word: "blocked",
      tone: "bad",
    });
    expect(statusWord(ws({ key: "a", group: "need" }))).toEqual({
      word: "needs you",
      tone: "warn",
    });
    expect(statusWord(ws({ key: "a", group: "move" })).word).toBe("moving");
    expect(statusWord(ws({ key: "a" })).word).toBe("quiet");
  });
});

describe("machineFace", () => {
  it("changes at 55 and 85 percent", () => {
    expect(machineFace(null)).toBe("smile");
    expect(machineFace(54)).toBe("smile");
    expect(machineFace(55)).toBe("busy");
    expect(machineFace(84)).toBe("busy");
    expect(machineFace(85)).toBe("hot");
  });
});

describe("machineColour", () => {
  it("uses the spec colours for known machines and a stable fallback otherwise", () => {
    expect(machineColour("ablearn", "e1")).toBe("#ff9eb5");
    expect(machineColour("m4-pro", "e2")).toBe("#8fd3ff");
    expect(machineColour("studio", "e3")).toBe(machineColour("studio", "e3"));
  });
});

describe("usageMeters", () => {
  it("takes the most-used window per provider and skips providers with none", () => {
    const pool = (driver: string, used: number[]) =>
      ({ driver, accounts: [], windows: used.map((usedPercent) => ({ usedPercent })) }) as never;
    expect(
      usageMeters([pool("claudeAgent", [12, 74]), pool("codex", [38]), pool("pi", [])]),
    ).toEqual([
      { driver: "claudeAgent", name: "Claude", percent: 74 },
      { driver: "codex", name: "Codex", percent: 38 },
    ]);
  });
});
