/**
 * Removed workspaces: a per-browser list of project keys the sidebar leaves out. Nothing is
 * deleted or archived on the server, so its sessions come back with it. A removed workspace
 * returns when it becomes the open one again (picked in the new-session chip, or added again).
 */

/** Drops removed workspaces from the list, keeping the order of the rest. */
export function shownWorkspaces<T>(
  groups: ReadonlyArray<T>,
  input: { readonly removedKeys: ReadonlyArray<string>; readonly keyOf: (group: T) => string },
): ReadonlyArray<T> {
  if (input.removedKeys.length === 0) return groups;
  const removed = new Set(input.removedKeys);
  return groups.filter((group) => !removed.has(input.keyOf(group)));
}

/** There is no "show" item: a removed workspace is not listed, so it has no menu. */
export const WORKSPACE_REMOVE_MENU_ITEM = {
  id: "remove-workspace",
  label: "Remove from sidebar",
} as const;

export function setWorkspaceRemoved(
  keys: ReadonlyArray<string>,
  key: string,
  removed: boolean,
): ReadonlyArray<string> {
  if (keys.includes(key) === removed) return keys;
  return removed ? [...keys, key] : keys.filter((candidate) => candidate !== key);
}

/** Also reads `hiddenKeys`, the field this list was saved under before it was renamed. */
export function sanitizePersistedRemovedKeys(persisted: unknown): ReadonlyArray<string> {
  const saved =
    typeof persisted === "object" && persisted !== null
      ? (persisted as { removedKeys?: unknown; hiddenKeys?: unknown })
      : undefined;
  const keys = saved?.removedKeys ?? saved?.hiddenKeys;
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && key !== ""))];
}
