import { describe, expect, it } from "vite-plus/test";

import {
  sanitizePersistedRemovedKeys,
  setWorkspaceRemoved,
  workspaceToRestore,
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

  it("removes once and returns on request", () => {
    const removed = setWorkspaceRemoved([], "a", true);
    expect(removed).toEqual(["a"]);
    expect(setWorkspaceRemoved(removed, "a", true)).toBe(removed);
    expect(setWorkspaceRemoved(removed, "a", false)).toEqual([]);
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

describe("workspaceToRestore", () => {
  const at = (routeId: string, workspaceKey: string) => ({ routeId, workspaceKey });
  const removedKeys = ["w"];

  it("restores when a route opens a removed workspace", () => {
    expect(
      workspaceToRestore({ previous: at("r1", "x"), current: at("r2", "w"), removedKeys }),
    ).toBe("w");
  });

  it("restores when the chip moves the same draft to a removed workspace", () => {
    expect(workspaceToRestore({ previous: at("d", "x"), current: at("d", "w"), removedKeys })).toBe(
      "w",
    );
  });

  it("restores nothing on first mount, so a reload onto a removed workspace stays removed", () => {
    expect(workspaceToRestore({ previous: null, current: at("r1", "w"), removedKeys })).toBeNull();
  });

  it("restores nothing while the open workspace is unknown", () => {
    expect(workspaceToRestore({ previous: at("r1", "x"), current: null, removedKeys })).toBeNull();
    // null then back to the same W: the caller kept W as previous, so nothing moved.
    expect(
      workspaceToRestore({ previous: at("r1", "w"), current: at("r1", "w"), removedKeys }),
    ).toBeNull();
  });

  it("restores nothing when you remove the workspace you are in and the route stays", () => {
    expect(
      workspaceToRestore({ previous: at("r1", "w"), current: at("r1", "w"), removedKeys }),
    ).toBeNull();
  });

  it("restores nothing for a workspace that is not removed", () => {
    expect(
      workspaceToRestore({ previous: at("r1", "x"), current: at("r2", "y"), removedKeys }),
    ).toBeNull();
  });
});
