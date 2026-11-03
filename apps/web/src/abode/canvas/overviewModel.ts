/** The overview (A-048) as plain data: hero counts, machine sections, milestone bars, meters. */
import type { LimitPool } from "@t3tools/shared/usageLimits";

import { planBlock, type PlanFileState } from "./planBlock";
import type { RailGroup } from "./railGroups";

const GROUP_ORDER: ReadonlyArray<RailGroup> = ["need", "jam", "move", "quiet"];

export interface OverviewWorkspace {
  readonly key: string;
  readonly name: string;
  readonly group: RailGroup;
  /** Live session pills (the "N sessions" figure). */
  readonly sessions: number;
  readonly running: number;
  /** A session is blocked or failed: the red count. */
  readonly red: boolean;
  readonly environmentId: string | undefined;
}

export interface OverviewHero {
  readonly need: number;
  readonly red: number;
  readonly running: number;
}

export function heroCounts(workspaces: ReadonlyArray<OverviewWorkspace>): OverviewHero {
  return {
    need: workspaces.filter((workspace) => workspace.group === "need").length,
    red: workspaces.filter((workspace) => workspace.red).length,
    running: workspaces.reduce((sum, workspace) => sum + workspace.running, 0),
  };
}

export interface OverviewMachineInput {
  readonly environmentId: string;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly online: boolean;
  /** Whole percent, null when the host cannot report it. */
  readonly cpu: number | null;
}

export interface OverviewMachine extends OverviewMachineInput {
  readonly agents: number;
  /** Sorted need, jam, move, quiet; the given order holds inside a group. */
  readonly rows: ReadonlyArray<OverviewWorkspace>;
}

/** One section per machine; a workspace on an unknown machine lands on the first one. */
export function overviewMachines(
  machines: ReadonlyArray<OverviewMachineInput>,
  workspaces: ReadonlyArray<OverviewWorkspace>,
): OverviewMachine[] {
  const first = machines[0]?.environmentId;
  return machines.map((machine) => {
    const mine = workspaces.filter((workspace) => {
      const home = machines.some((m) => m.environmentId === workspace.environmentId)
        ? workspace.environmentId
        : first;
      return home === machine.environmentId;
    });
    const rows = GROUP_ORDER.flatMap((group) => mine.filter((row) => row.group === group));
    return { ...machine, agents: rows.reduce((sum, row) => sum + row.running, 0), rows };
  });
}

export type MilestoneSegment = "done" | "current" | "todo";

export interface MilestoneBar {
  readonly segments: ReadonlyArray<MilestoneSegment>;
  /** The current milestone, "◎ <goal>" when finished, or why there is no bar. */
  readonly label: string;
  readonly done: number;
  readonly finished: boolean;
}

export function milestoneBar(state: PlanFileState): MilestoneBar {
  const block = planBlock(state);
  if (block.kind !== "ready") {
    const label =
      block.kind === "loading" ? "…" : block.kind === "missing" ? "no plan" : "plan unreadable";
    return { segments: [], label, done: 0, finished: false };
  }
  const segments = block.rows.map((row) => row.state);
  const done = segments.filter((segment) => segment === "done").length;
  const finished = done === segments.length;
  const current = block.rows.find((row) => row.state === "current");
  const label = finished
    ? `◎ ${block.goal ?? "goal"}`
    : (current?.name ?? block.rows.find((row) => row.state === "todo")?.name ?? "");
  return { segments, label, done, finished };
}

export function statusWord(workspace: OverviewWorkspace): {
  readonly word: string;
  readonly tone: "bad" | "warn" | "neutral";
} {
  if (workspace.red) return { word: "blocked", tone: "bad" };
  if (workspace.group === "need") return { word: "needs you", tone: "warn" };
  if (workspace.group === "move") return { word: "moving", tone: "neutral" };
  if (workspace.group === "jam") return { word: "jamming", tone: "neutral" };
  return { word: "quiet", tone: "neutral" };
}

/** Smile under 55% load, an "o" mouth and a sweat drop from 55%, a second drop from 85%. */
export function machineFace(cpu: number | null): "smile" | "busy" | "hot" {
  if (cpu === null || cpu < 55) return "smile";
  return cpu < 85 ? "busy" : "hot";
}

const KNOWN_COLOURS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ablearn/i, "#ff9eb5"],
  [/m4/i, "#8fd3ff"],
];
const FALLBACK_COLOURS = ["#ffd43b", "#b9a7ff", "#7be0b0", "#ffb36b", "#7aa2ff"];

/** Spec section 7 colours for the known machines, else a palette slot that stays the same per machine. */
export function machineColour(label: string, environmentId: string): string {
  const known = KNOWN_COLOURS.find(([pattern]) => pattern.test(label));
  if (known) return known[1];
  let hash = 0;
  for (const char of environmentId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length]!;
}

export interface UsageMeter {
  readonly driver: string;
  readonly name: string;
  /** The most-used window, whole percent. */
  readonly percent: number;
}

const METER_NAMES: Readonly<Record<string, string>> = {
  claudeAgent: "Claude",
  codex: "Codex",
  cursor: "Cursor",
  opencode: "OpenCode",
  grok: "Grok",
};

/** One meter per provider that reports a window: the window closest to its limit. */
export function usageMeters(pools: ReadonlyArray<LimitPool>): UsageMeter[] {
  return pools.flatMap((pool) =>
    pool.windows.length === 0
      ? []
      : [
          {
            driver: pool.driver,
            name: METER_NAMES[pool.driver] ?? pool.driver,
            percent: Math.max(...pool.windows.map((window) => window.usedPercent)),
          },
        ],
  );
}
