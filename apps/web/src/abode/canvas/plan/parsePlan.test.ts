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

## Phase B: the abode chat (brief: docs/briefs/chat-revamp.md)

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
          key: "0-the engine is upstream",
          name: "the engine is upstream",
          state: "done",
          done: 2,
          total: 2,
          tickets: [
            { id: "A-001", name: "Sync strategy and tooling", state: "done" },
            {
              id: "A-002",
              name: "abode theme and fonts",
              state: "done",
              note: "reviewer PASS, merged. Needs Abhishek to look",
            },
          ],
        },
        {
          key: "1-the abode chat",
          name: "the abode chat",
          detail: "brief: docs/briefs/chat-revamp.md",
          state: "current",
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
    const md = ["todo", "DOING", "blocked", "review", "done", "wat"]
      .map((s, i) => `### T-00${i}: t${i}\n\n- **Status:** ${s}\n`)
      .join("\n");
    const plan = parsePlan(`## Milestone: M\n\n${md}`);
    expect(plan.milestones[0]!.tickets.map((t) => t.state)).toEqual([
      "todo",
      "running",
      "stopped",
      "done",
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

  it("picks the last started unfinished milestone as current; stale ones stay todo", () => {
    const md = `## Phase A: old
### A-1: a
- **Status:** done
### A-2: b
- **Status:** todo

## Phase B: stale
### B-1: a
- **Status:** review (awaiting look)
### B-2: b
- **Status:** todo

## Phase B: later
### C-1: a
- **Status:** done
### C-2: b
- **Status:** todo
### C-3: c
- **Status:** todo
`;
    const { milestones } = parsePlan(md);
    expect(milestones.map((m) => [m.key, m.state])).toEqual([
      ["0-old", "todo"],
      ["1-stale", "todo"],
      ["2-later", "current"],
    ]);
  });

  it("falls back to the first unfinished milestone when none has started", () => {
    const md =
      "## Milestone: A\n### A-1: a\n- **Status:** todo\n## Milestone: B\n### B-1: b\n- **Status:** todo\n";
    expect(parsePlan(md).milestones.map((m) => m.state)).toEqual(["current", "todo"]);
  });

  it("keeps a note without parentheses", () => {
    const md = "## Milestone: M\n### T-1: a\n- **Status:** blocked needs a key\n";
    expect(parsePlan(md).milestones[0]!.tickets[0]).toEqual({
      id: "T-1",
      name: "a",
      state: "stopped",
      note: "needs a key",
    });
  });

  it("drops milestones without tickets and uses the first Goal", () => {
    const md =
      "Goal: one\nGoal: two\n## Milestone: Empty\n## Milestone: Full\n### T-1: a\n- **Status:** todo\n";
    const plan = parsePlan(md);
    expect(plan.goal).toBe("one");
    expect(plan.milestones.map((m) => m.name)).toEqual(["Full"]);
  });

  it("leaves a ticket todo when its status line is missing or not directly beneath", () => {
    const md = "## Milestone: M\n### T-1: a\n\n- **What:** x\n- **Status:** done\n### T-2: b\n";
    expect(parsePlan(md).milestones[0]!.tickets.map((t) => t.state)).toEqual(["todo", "todo"]);
  });

  it("ignores tickets inside HTML comments and fenced code", () => {
    const md = [
      "## Milestone: M",
      "<!--",
      "### X-1: hidden",
      "- **Status:** done",
      "-->",
      "```",
      "### X-2: sample",
      "```",
      "### X-3: real",
      "- **Status:** todo",
    ].join("\n");
    expect(parsePlan(md).milestones[0]!.tickets.map((t) => t.id)).toEqual(["X-3"]);
  });
});

describe("parsePlan, [status] format", () => {
  const FORMAT_C = `# Plan

## F-001 Tenant signup [done]
## F-002 Stripe billing [blocked]

# Engine v1

## Core gate (agreed 2026-10-15): nothing new until it holds

## F-055 GPU sweep [done]
## F-056 Big data never fails [doing] (owner: next after F-188)
## F-191 SQL honours GPU [todo, started and paused 2026-10-28] (found by F-162)
## F-190 Decimal read [done 2026-10-28]

# Later (brief docs/x.md, approved)

## F-200 Rings [todo]
`;

  it("reads # sections as milestones and ## tickets with bracket status", () => {
    const plan = parsePlan(FORMAT_C);
    expect(plan.milestones.map((m) => [m.name, m.state, m.done, m.total])).toEqual([
      ["Plan", "todo", 1, 2],
      ["Engine v1", "current", 2, 4],
      ["Later", "todo", 0, 1],
    ]);
  });

  it("maps statuses and notes, ignoring ## headings without an id and status", () => {
    const [, engine] = parsePlan(FORMAT_C).milestones;
    expect(engine!.tickets.map((t) => [t.id, t.state, t.note])).toEqual([
      ["F-055", "done", undefined],
      ["F-056", "running", "owner: next after F-188"],
      ["F-191", "todo", "found by F-162"],
      ["F-190", "done", undefined],
    ]);
  });

  it("keeps duplicate section names with unique keys", () => {
    const plan = parsePlan("# A\n## F-1 x [done]\n# A\n## F-1 x [todo]\n");
    expect(new Set(plan.milestones.map((m) => m.key)).size).toBe(2);
  });

  it("splits a single-# plan by its non-ticket ## headings", () => {
    const plan = parsePlan(`# Plan

## F-001 Template [done]

## Wave 1: foundations (parallel)

## F-002 Kernels [done]

## Wave 2: placement (phase 2)

## F-003 Router [doing]
## F-004 Joins [todo]

## Rings (after the gate)
`);
    expect(plan.milestones.map((m) => [m.name, m.detail, m.state, m.done, m.total])).toEqual([
      ["Plan", undefined, "done", 1, 1],
      ["Wave 1: foundations", "parallel", "done", 1, 1],
      ["Wave 2: placement", "phase 2", "current", 0, 2],
    ]);
  });

  it("moves a trailing parenthetical of a # heading into detail", () => {
    const [m] = parsePlan("# Mobile (brief docs/x.md)\n## F-1 a [todo]\n").milestones;
    expect([m!.name, m!.detail]).toEqual(["Mobile", "brief docs/x.md"]);
  });
});
