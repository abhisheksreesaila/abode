import { describe, expect, it } from "vite-plus/test";

import { parsePlan } from "../canvas/plan/parsePlan";
import { sanitizeMilestoneOpen } from "./frameStore";
import {
  ageLabel,
  isMilestoneOpen,
  milestoneId,
  milestoneStateWord,
  ticketChip,
} from "./milestonesModel";

const PLAN = `Goal: ship

## Milestone: One
### A-1: a
- **Status:** done
### A-2: b
- **Status:** review (x)

## Milestone: Two
### B-1: c
- **Status:** doing
### B-2: d
- **Status:** blocked
### B-3: e
- **Status:** todo

## Milestone: Three
### C-1: f
- **Status:** todo
`;

describe("ticketChip", () => {
  it("maps every plan status to its chip", () => {
    const tickets = parsePlan(PLAN).milestones.flatMap((m) => m.tickets);
    expect(tickets.map((t) => ticketChip(t))).toEqual([
      { tone: "done", label: "done" },
      { tone: "review", label: "in review" },
      { tone: "progress", label: "in progress" },
      { tone: "needs", label: "needs you" },
      { tone: "todo", label: "todo" },
      { tone: "todo", label: "todo" },
    ]);
  });
});

describe("milestones", () => {
  const { milestones } = parsePlan(PLAN);

  it("names the state with the design's words", () => {
    expect(milestones.map((m) => milestoneStateWord(m.state))).toEqual(["done", "in progress", ""]);
  });

  it("opens only the milestone in progress by default", () => {
    expect(milestones.map((m) => isMilestoneOpen(m, undefined))).toEqual([false, true, false]);
  });

  it("lets a remembered choice override the default either way", () => {
    const chosen = { [milestones[0]!.key]: true, [milestones[1]!.key]: false };
    expect(milestones.map((m) => isMilestoneOpen(m, chosen))).toEqual([true, false, false]);
  });

  it("numbers by position", () => {
    expect([0, 2].map(milestoneId)).toEqual(["M1", "M3"]);
  });
});

describe("ageLabel", () => {
  it("rounds down to the largest unit", () => {
    const at = 1_000_000;
    expect(
      [0, 59_000, 5 * 60_000, 3 * 3_600_000 + 1, 49 * 3_600_000].map((d) => ageLabel(at, at + d)),
    ).toEqual(["just now", "just now", "5m ago", "3h ago", "2d ago"]);
  });
});

describe("sanitizeMilestoneOpen", () => {
  it("keeps boolean choices per workspace and drops anything else", () => {
    expect(
      sanitizeMilestoneOpen({
        milestoneOpen: { w1: { a: true, b: "x", c: false }, w2: "bad", w3: [1] },
      }),
    ).toEqual({ w1: { a: true, c: false } });
    expect(sanitizeMilestoneOpen(null)).toEqual({});
  });
});
