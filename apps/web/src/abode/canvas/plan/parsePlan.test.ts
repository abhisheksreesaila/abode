import { describe, expect, it } from "vite-plus/test";

import { parsePlan } from "./parsePlan";

const REPO_STYLE = `# abode plan

<!--
Status: todo | doing | blocked | review | done
-->

## Rules for every ticket

- New code goes in apps/web.

## Phase A: the engine is upstream

### A-001: Sync strategy and tooling

- **Status:** done
- **What:** tooling.

### A-002: abode theme and fonts

- **Status:** review (reviewer PASS, merged. Needs Abhishek to look)

## Phase B: the abode chat

### A-009: Cards in the chat

- **Status:** doing

### A-010: The board column

- **Status:** blocked (needs a key from Abhishek)

### A-011: Avatars

- **Status:** todo
`;

const MILESTONE_STYLE = `Goal: Ship the invoice app to ten users

## Milestone: Sign-in

### X-001: Login page

- **Status:** done

### X-002: Logout

- **Status:** done

## Milestone: Billing

### X-003: Checkout

- **Status:** doing (waiting on Stripe test keys)

### X-004: Receipts

- **Status:** todo

## Milestone: Launch

### X-005: Landing page

- **Status:** todo
`;

describe("parsePlan", () => {
  it("treats phases as milestones in this repo's plan.md style", () => {
    expect(parsePlan(REPO_STYLE)).toEqual({
      milestones: [
        {
          name: "the engine is upstream",
          state: "current",
          done: 1,
          total: 2,
          tickets: [
            { id: "A-001", name: "Sync strategy and tooling", state: "done" },
            {
              id: "A-002",
              name: "abode theme and fonts",
              state: "running",
              note: "reviewer PASS, merged. Needs Abhishek to look",
            },
          ],
        },
        {
          name: "the abode chat",
          state: "todo",
          done: 0,
          total: 3,
          tickets: [
            { id: "A-009", name: "Cards in the chat", state: "running" },
            {
              id: "A-010",
              name: "The board column",
              state: "stopped",
              note: "needs a key from Abhishek",
            },
            { id: "A-011", name: "Avatars", state: "todo" },
          ],
        },
      ],
    });
  });

  it("reads the goal, milestones, and statuses with notes in the milestone style", () => {
    const plan = parsePlan(MILESTONE_STYLE);
    expect(plan.goal).toBe("Ship the invoice app to ten users");
    expect(plan.milestones.map((m) => [m.name, m.state, m.done, m.total])).toEqual([
      ["Sign-in", "done", 2, 2],
      ["Billing", "current", 0, 2],
      ["Launch", "todo", 0, 1],
    ]);
    expect(plan.milestones[1]!.tickets).toEqual([
      { id: "X-003", name: "Checkout", state: "running", note: "waiting on Stripe test keys" },
      { id: "X-004", name: "Receipts", state: "todo" },
    ]);
  });

  it("maps every status word and falls back to todo", () => {
    const md = ["todo", "doing", "blocked", "review", "done", "wat"]
      .map((s, i) => `### T-00${i}: t${i}\n\n- **Status:** ${s}\n`)
      .join("\n");
    const plan = parsePlan(`## Milestone: M\n\n${md}`);
    expect(plan.milestones[0]!.tickets.map((t) => t.state)).toEqual([
      "todo",
      "running",
      "stopped",
      "running",
      "done",
      "todo",
    ]);
  });

  it("marks a milestone done when all its tickets are done", () => {
    const plan = parsePlan("## Milestone: M\n\n### T-1: a\n\n- **Status:** done\n");
    expect(plan.milestones[0]).toMatchObject({ state: "done", done: 1, total: 1 });
  });

  it("returns no milestones for an empty string", () => {
    expect(parsePlan("")).toEqual({ milestones: [] });
  });
});
