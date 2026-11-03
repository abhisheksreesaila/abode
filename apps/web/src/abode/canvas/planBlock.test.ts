import { describe, expect, it } from "vite-plus/test";

import { planBlock } from "./planBlock";

const PLAN = `Goal: ship it

## Milestone: First
### A-001: one
- **Status:** done
### A-002: two
- **Status:** doing (agent)
`;

describe("planBlock", () => {
  it("shows loading, never an empty plan, while the first read is in flight", () => {
    expect(planBlock({ error: null, file: null })).toEqual({ kind: "loading" });
  });

  it("says missing for an absent plan.md", () => {
    expect(planBlock({ error: null, file: { exists: false, contents: "" } })).toEqual({
      kind: "missing",
    });
  });

  it("says missing for a file with no milestones", () => {
    expect(planBlock({ error: null, file: { exists: true, contents: "# notes" } })).toEqual({
      kind: "missing",
    });
  });

  it("shows the error when nothing could be read", () => {
    expect(planBlock({ error: "nope", file: null })).toEqual({ kind: "error", message: "nope" });
  });

  it("keeps showing the last plan when a refresh fails", () => {
    expect(planBlock({ error: "nope", file: { exists: true, contents: PLAN } }).kind).toBe("ready");
  });

  it("maps a plan to its goal and milestone rows", () => {
    const block = planBlock({ error: null, file: { exists: true, contents: PLAN } });
    if (block.kind !== "ready") throw new Error("expected ready");
    expect(block.goal).toBe("ship it");
    expect(block.rows.map((r) => [r.key, r.state, r.done, r.total])).toEqual([
      ["0-First", "current", 1, 2],
    ]);
  });
});
