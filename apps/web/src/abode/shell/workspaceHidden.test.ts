import { describe, expect, it } from "vite-plus/test";

import {
  sanitizePersistedHiddenKeys,
  setWorkspaceHidden,
  splitHiddenWorkspaces,
} from "./workspaceHidden";

const split = (groups: string[], hiddenKeys: string[], active: string | null = null) =>
  splitHiddenWorkspaces(groups, {
    hiddenKeys,
    keyOf: (group) => group,
    isActive: (group) => group === active,
  });

describe("hidden workspaces", () => {
  it("moves hidden workspaces out of the list, keeping order", () => {
    expect(split(["a", "b", "c", "d"], ["c", "a"])).toEqual({
      shown: ["b", "d"],
      hidden: ["a", "c"],
    });
  });

  it("keeps the workspace holding the open session shown", () => {
    expect(split(["a", "b"], ["a", "b"], "b")).toEqual({ shown: ["b"], hidden: ["a"] });
  });

  it("ignores keys for workspaces that no longer exist", () => {
    expect(split(["a"], ["gone"])).toEqual({ shown: ["a"], hidden: [] });
  });

  it("hides and shows again (the way back out)", () => {
    const hidden = setWorkspaceHidden([], "a", true);
    expect(hidden).toEqual(["a"]);
    expect(setWorkspaceHidden(hidden, "a", true)).toBe(hidden);
    expect(setWorkspaceHidden(hidden, "a", false)).toEqual([]);
  });

  it("drops junk from storage", () => {
    expect(sanitizePersistedHiddenKeys({ hiddenKeys: ["a", 3, "", "a", "b"] })).toEqual(["a", "b"]);
    expect(sanitizePersistedHiddenKeys(null)).toEqual([]);
    expect(sanitizePersistedHiddenKeys({ hiddenKeys: "a" })).toEqual([]);
  });
});
