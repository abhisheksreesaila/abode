import { describe, expect, it } from "vite-plus/test";

import {
  sanitizePersistedRemovedKeys,
  setWorkspaceRemoved,
  shownWorkspaces,
  WORKSPACE_REMOVE_MENU_ITEM,
} from "./workspaceRemoved";

const shown = (groups: string[], removedKeys: string[]) =>
  shownWorkspaces(groups, { removedKeys, keyOf: (group) => group });

describe("removed workspaces", () => {
  it("drops removed workspaces from the list, keeping order", () => {
    expect(shown(["a", "b", "c", "d"], ["c", "a"])).toEqual(["b", "d"]);
  });

  it("ignores keys for workspaces that no longer exist", () => {
    expect(shown(["a"], ["gone"])).toEqual(["a"]);
  });

  it("removes once, and brings the workspace back when it is opened again", () => {
    const removed = setWorkspaceRemoved([], "a", true);
    expect(removed).toEqual(["a"]);
    expect(setWorkspaceRemoved(removed, "a", true)).toBe(removed);
    expect(shown(["a", "b"], [...removed])).toEqual(["b"]);

    const back = setWorkspaceRemoved(removed, "a", false);
    expect(back).toEqual([]);
    expect(shown(["a", "b"], [...back])).toEqual(["a", "b"]);
    // Opening it again later changes nothing: it stays back.
    expect(setWorkspaceRemoved(back, "a", false)).toBe(back);
  });

  it("only ever offers Remove from sidebar", () => {
    expect(WORKSPACE_REMOVE_MENU_ITEM).toEqual({
      id: "remove-workspace",
      label: "Remove from sidebar",
    });
  });

  it("drops junk from storage", () => {
    expect(sanitizePersistedRemovedKeys({ removedKeys: ["a", 3, "", "a", "b"] })).toEqual([
      "a",
      "b",
    ]);
    expect(sanitizePersistedRemovedKeys(null)).toEqual([]);
    expect(sanitizePersistedRemovedKeys({ removedKeys: "a" })).toEqual([]);
  });

  it("reads entries saved as hidden before the rename", () => {
    expect(sanitizePersistedRemovedKeys({ hiddenKeys: ["a", "b"] })).toEqual(["a", "b"]);
  });
});
