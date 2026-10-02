import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  EMPTY_WORKSPACE_COLOR_ASSIGNMENTS,
  WORKSPACE_COLORS,
  buildWorkspaceColorMenuItem,
  ensureAssigned,
  sanitizePersistedAssignments,
  syncAssigned,
  hashWorkspaceColorIndex,
  nextAutoColorIndex,
  parseWorkspaceColorMenuId,
  resetOverride,
  resolveWorkspaceColorIndex,
  setOverride,
  workspaceColorCss,
} from "./workspaceColor";
import { applyWorkspaceColorMenuChoice, useWorkspaceColorStore } from "./workspaceColorStore";

const empty = EMPTY_WORKSPACE_COLOR_ASSIGNMENTS;

describe("workspace color assignment", () => {
  it("gives the first eight projects distinct colors in first-seen order", () => {
    const keys = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const state = ensureAssigned(empty, keys);
    expect(keys.map((key) => state.assigned[key])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("reuses the least-used slot once the palette is exhausted", () => {
    const keys = Array.from({ length: 9 }, (_, i) => `p${i}`);
    const state = ensureAssigned(empty, keys);
    expect(state.assigned.p8).toBe(0);
    expect(nextAutoColorIndex(state.assigned)).toBe(1);
  });

  it("is stable: seen projects keep their color and return the same state", () => {
    const first = ensureAssigned(empty, ["a", "b"]);
    const again = ensureAssigned(first, ["b", "a", "c"]);
    expect(again.assigned.a).toBe(first.assigned.a);
    expect(again.assigned.b).toBe(first.assigned.b);
    expect(ensureAssigned(again, ["a", "b", "c"])).toBe(again);
  });

  it("override wins, and reset returns to the automatic color", () => {
    const assigned = ensureAssigned(empty, ["a", "b"]);
    const overridden = setOverride(assigned, "a", 5);
    expect(resolveWorkspaceColorIndex(overridden, "a")).toBe(5);
    expect(resolveWorkspaceColorIndex(overridden, "b")).toBe(1);
    const reset = resetOverride(overridden, "a");
    expect(resolveWorkspaceColorIndex(reset, "a")).toBe(0);
    expect(resetOverride(reset, "a")).toBe(reset);
  });

  it("overrides do not take part in automatic assignment", () => {
    const state = setOverride(ensureAssigned(empty, ["a"]), "a", 3);
    expect(ensureAssigned(state, ["b"]).assigned.b).toBe(1);
  });

  it("ignores out-of-range overrides", () => {
    expect(setOverride(empty, "a", 99)).toBe(empty);
    expect(setOverride(empty, "a", -1)).toBe(empty);
  });

  it("falls back to a stable hash for unassigned keys", () => {
    const index = resolveWorkspaceColorIndex(empty, "env:/repo");
    expect(index).toBe(hashWorkspaceColorIndex("env:/repo"));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(WORKSPACE_COLORS.length);
  });

  it("references theme variables with fallbacks", () => {
    expect(workspaceColorCss(0)).toBe("var(--ws-1, #4fc1ff)");
    expect(workspaceColorCss(7)).toBe("var(--ws-8, #d7ba7d)");
  });
});

describe("workspace color menu", () => {
  it("round-trips every menu item id", () => {
    const item = buildWorkspaceColorMenuItem();
    expect(item.children.map((child) => parseWorkspaceColorMenuId(child.id))).toEqual([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      "reset",
    ]);
    expect(parseWorkspaceColorMenuId("rename")).toBeNull();
    expect(parseWorkspaceColorMenuId("workspace-color:99")).toBeNull();
  });
});

describe("workspace color store", () => {
  beforeEach(() => {
    useWorkspaceColorStore.setState({ assigned: {}, overrides: {} });
  });

  it("changes and resets a color through menu choices", () => {
    const store = useWorkspaceColorStore;
    store.getState().ensureAssigned(["a", "b"]);
    expect(applyWorkspaceColorMenuChoice("a", "workspace-color:6")).toBe(true);
    expect(resolveWorkspaceColorIndex(store.getState(), "a")).toBe(6);
    expect(applyWorkspaceColorMenuChoice("a", "workspace-color:reset")).toBe(true);
    expect(resolveWorkspaceColorIndex(store.getState(), "a")).toBe(0);
    expect(applyWorkspaceColorMenuChoice("a", "rename")).toBe(false);
  });
});

describe("workspace color sync and sanitizing", () => {
  it("frees the slots of removed projects so new ones reuse them", () => {
    const first = syncAssigned(empty, ["a", "b", "c"]);
    const next = syncAssigned(first, ["b", "c", "d"]);
    expect(next.assigned).toEqual({ b: 1, c: 2, d: 0 });
  });

  it("ignores an empty live list (projects not loaded yet)", () => {
    const first = syncAssigned(empty, ["a"]);
    expect(syncAssigned(first, [])).toBe(first);
  });

  it("drops malformed stored data", () => {
    expect(sanitizePersistedAssignments({ assigned: null, overrides: [1] })).toEqual({
      assigned: {},
      overrides: {},
    });
    expect(sanitizePersistedAssignments({ assigned: { a: 2, b: 99, c: "x" } }).assigned).toEqual({
      a: 2,
    });
    expect(sanitizePersistedAssignments(undefined)).toEqual({ assigned: {}, overrides: {} });
  });
});
