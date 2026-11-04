import type { ComposeSession } from "./composeBlocks";
import type { MilestoneState } from "./plan/parsePlan";

/** Geometry of the prototype's journey map (docs/canvas/prototype.html, C3 `journey`): a 1000 x 170 viewBox. */
const CY = 96;
const X0 = 92;
const X1 = 860;
const STICKER_H = 44;
const START: Point = [38, CY + 12];
const GOAL_FOOT: Point = [930, CY + 10];
const GOAL_STAND: Point = [930, CY - 34];

type Point = readonly [number, number];

export interface Station {
  readonly name: string;
  readonly label: string;
  readonly state: MilestoneState;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotate: number;
}

export interface JourneyLayout {
  readonly stations: ReadonlyArray<Station>;
  /** Where the robot stands: the start, then above each milestone, then the goal. */
  readonly stands: ReadonlyArray<Point>;
  /** The route as an SVG path through start, stickers and goal. */
  readonly path: string;
  /** Index into `stands` the robot is on: the current milestone, or the goal once all are done. */
  readonly cur: number;
  readonly done: boolean;
  /** Fraction of the route already walked. */
  readonly walked: number;
  readonly goalLines: ReadonlyArray<string>;
  readonly start: Point;
  readonly goalFoot: Point;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The goal in up to three lines of about 20 characters. */
export function goalLines(goal: string | undefined): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of (goal ?? "").split(" ")) {
    if (`${line} ${word}`.trim().length > 20 && lines.length < 2 && line.trim() !== "") {
      lines.push(line.trim());
      line = word;
    } else line += ` ${word}`;
  }
  if (line.trim() !== "") lines.push(line.trim());
  return lines.slice(0, 3);
}

export function journeyLayout(
  milestones: ReadonlyArray<{ readonly name: string; readonly state: MilestoneState }>,
  goal: string | undefined,
): JourneyLayout {
  const n = milestones.length;
  const spacing = (X1 - X0) / n;
  const width = Math.max(70, Math.min(150, spacing - 26));
  const maxChars = Math.floor(width / 8.2);
  const cx = (i: number) => X0 + spacing * (i + 0.5);
  const yy = (i: number) => CY + (i % 2 === 1 ? 9 : -7);
  const current = milestones.findIndex((milestone) => milestone.state === "current");
  const done = current < 0 && milestones.every((milestone) => milestone.state === "done");
  const stations: Station[] = milestones.map((milestone, i) => ({
    name: milestone.name,
    label: truncate(milestone.name, maxChars),
    state: milestone.state,
    x: cx(i),
    y: yy(i),
    width,
    height: STICKER_H,
    rotate: i % 2 === 1 ? 2 : -2,
  }));
  const stands: Point[] = [
    START,
    ...stations.map((s): Point => [s.x, s.y - STICKER_H / 2 - 22]),
    GOAL_STAND,
  ];
  const nodes: Point[] = [START, ...stations.map((s): Point => [s.x, s.y]), GOAL_FOOT];
  let path = `M ${nodes[0]![0]} ${nodes[0]![1]}`;
  for (let k = 1; k < nodes.length; k++) {
    const [px, py] = nodes[k - 1]!;
    const [x, y] = nodes[k]!;
    path += ` Q ${(px + x) / 2} ${(py + y) / 2 + (k % 2 === 1 ? 22 : -22)} ${x} ${y}`;
  }
  const cur = done ? n + 1 : Math.max(current, 0) + 1;
  return {
    stations,
    stands,
    path,
    cur,
    done,
    walked: cur / (n + 1),
    goalLines: goalLines(goal),
    start: START,
    goalFoot: GOAL_FOOT,
  };
}

export type RobotSymbol = "!" | "?" | "♪" | "…" | "★" | "z";

/** The robot's bubble: blocked, asking, jamming, working, goal reached, or asleep with nothing live. */
export function robotSymbol(input: {
  readonly done: boolean;
  readonly sessions: ReadonlyArray<Pick<ComposeSession, "status" | "mode">>;
}): RobotSymbol {
  if (input.done) return "★";
  const { sessions } = input;
  const lead =
    sessions.find((session) => session.status === "blocked") ??
    sessions.find((session) => session.mode === "grill") ??
    sessions.find((session) => session.mode === "jam") ??
    sessions.find((session) => session.status === "waiting on you") ??
    sessions[0];
  if (lead === undefined) return "z";
  if (lead.status === "blocked") return "!";
  if (lead.mode === "grill") return "?";
  if (lead.mode === "jam") return "♪";
  return lead.status === "waiting on you" ? "?" : "…";
}

const SYMBOL_TONE: Record<RobotSymbol, string> = {
  "!": "#ff5a5f",
  "?": "#ff9f43",
  "♪": "#1fb8a6",
  "…": "#1c1c20",
  "★": "#1c1c20",
  z: "#1c1c20",
};

export const symbolTone = (symbol: RobotSymbol): string => SYMBOL_TONE[symbol];
