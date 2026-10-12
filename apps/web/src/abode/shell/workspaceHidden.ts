/**
 * Hidden workspaces: a per-browser list of project keys the sidebar tucks under
 * a "hidden" row. Nothing is deleted or archived on the server; showing the
 * workspace again brings it back as it was.
 */

export interface WorkspaceVisibility<T> {
  readonly shown: ReadonlyArray<T>;
  readonly hidden: ReadonlyArray<T>;
}

/**
 * Splits workspaces into shown and hidden, keeping their order. A hidden
 * workspace that holds the open session or draft stays shown, so the row you
 * are on never disappears.
 */
export function splitHiddenWorkspaces<T>(
  groups: ReadonlyArray<T>,
  input: {
    readonly hiddenKeys: ReadonlyArray<string>;
    readonly keyOf: (group: T) => string;
    readonly isActive: (group: T) => boolean;
  },
): WorkspaceVisibility<T> {
  if (input.hiddenKeys.length === 0) return { shown: groups, hidden: [] };
  const hiddenKeys = new Set(input.hiddenKeys);
  const shown: T[] = [];
  const hidden: T[] = [];
  for (const group of groups) {
    if (hiddenKeys.has(input.keyOf(group)) && !input.isActive(group)) hidden.push(group);
    else shown.push(group);
  }
  return { shown, hidden };
}

export function setWorkspaceHidden(
  keys: ReadonlyArray<string>,
  key: string,
  hidden: boolean,
): ReadonlyArray<string> {
  if (keys.includes(key) === hidden) return keys;
  return hidden ? [...keys, key] : keys.filter((candidate) => candidate !== key);
}

export function sanitizePersistedHiddenKeys(persisted: unknown): ReadonlyArray<string> {
  const keys =
    typeof persisted === "object" && persisted !== null
      ? (persisted as { hiddenKeys?: unknown }).hiddenKeys
      : undefined;
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && key !== ""))];
}
