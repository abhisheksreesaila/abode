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

export interface OpenWorkspace {
  readonly routeId: string;
  readonly workspaceKey: string;
}

/**
 * Only a transition restores a removed workspace (route changed, or the chip moved the draft),
 * so a reload onto it, or removing the one you are in, keeps it removed. First mount and an
 * unknown current workspace restore nothing. The caller keeps the last non-null `current`.
 */
export function workspaceToRestore(input: {
  readonly previous: OpenWorkspace | null;
  readonly current: OpenWorkspace | null;
  readonly removedKeys: ReadonlyArray<string>;
}): string | null {
  const { previous, current, removedKeys } = input;
  if (previous === null || current === null) return null;
  const moved =
    previous.routeId !== current.routeId || previous.workspaceKey !== current.workspaceKey;
  return moved && removedKeys.includes(current.workspaceKey) ? current.workspaceKey : null;
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
