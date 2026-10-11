/**
 * Workspace colors (abode F-006). Each project (workspace) carries one accent
 * color from an eight-slot palette. Pure assignment logic lives here; the
 * persisted client-side store is `workspaceColorStore.ts`.
 *
 * Slots reference the theme's `--ws-1..--ws-8` variables with the Dark Modern
 * hues as fallbacks, so the palette works before the theme variables exist.
 */

export interface WorkspaceColorSlot {
  readonly name: string;
  readonly cssVar: string;
  readonly fallback: string;
}

export const WORKSPACE_COLORS: ReadonlyArray<WorkspaceColorSlot> = [
  { name: "Blue", cssVar: "--ws-1", fallback: "#4fc1ff" },
  { name: "Purple", cssVar: "--ws-2", fallback: "#c586c0" },
  { name: "Yellow", cssVar: "--ws-3", fallback: "#dcdcaa" },
  { name: "Teal", cssVar: "--ws-4", fallback: "#4ec9b0" },
  { name: "Coral", cssVar: "--ws-5", fallback: "#f48771" },
  { name: "Green", cssVar: "--ws-6", fallback: "#b5cea8" },
  { name: "Sky", cssVar: "--ws-7", fallback: "#9cdcfe" },
  { name: "Sand", cssVar: "--ws-8", fallback: "#d7ba7d" },
];

export interface WorkspaceColorAssignments {
  /** Automatic color per project key. Persisted so a color never shifts. */
  readonly assigned: Readonly<Record<string, number>>;
  /** User-chosen color per project key; removed by "Reset color". */
  readonly overrides: Readonly<Record<string, number>>;
}

export const EMPTY_WORKSPACE_COLOR_ASSIGNMENTS: WorkspaceColorAssignments = {
  assigned: {},
  overrides: {},
};

function isValidIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < WORKSPACE_COLORS.length
  );
}

/** CSS color for a slot, e.g. `var(--ws-1, #4fc1ff)`. */
export function workspaceColorCss(index: number): string {
  const slot = WORKSPACE_COLORS[isValidIndex(index) ? index : 0]!;
  return `var(${slot.cssVar}, ${slot.fallback})`;
}

/** Stable string hash, used only to color a project before it is assigned. */
export function hashWorkspaceColorIndex(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % WORKSPACE_COLORS.length;
}

/**
 * The next automatic color: the least-used slot among the automatic
 * assignments of the currently listed projects (lowest index on ties), so new
 * projects stay distinct until all eight are taken. Stored entries for
 * projects not listed (a remote still loading) never move, but do not count.
 * Overrides do not count: "Reset color" must always be able to return to the
 * assigned slot.
 */
export function nextAutoColorIndex(
  assigned: Readonly<Record<string, number>>,
  liveKeys: ReadonlyArray<string> = Object.keys(assigned),
): number {
  const counts = Array.from({ length: WORKSPACE_COLORS.length }, () => 0);
  for (const key of liveKeys) {
    const index = assigned[key];
    if (isValidIndex(index)) counts[index]! += 1;
  }
  let best = 0;
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i]! < counts[best]!) best = i;
  }
  return best;
}

/** Assign colors to keys not yet seen, in the given (first-seen) order. */
export function ensureAssigned(
  state: WorkspaceColorAssignments,
  keys: ReadonlyArray<string>,
): WorkspaceColorAssignments {
  let assigned: Record<string, number> | null = null;
  for (const key of keys) {
    const current = assigned ?? state.assigned;
    if (isValidIndex(current[key])) continue;
    assigned ??= { ...state.assigned };
    assigned[key] = nextAutoColorIndex(assigned, keys);
  }
  return assigned === null ? state : { ...state, assigned };
}

/**
 * Reconcile with the listed projects: assign the unseen ones in list order.
 * Stored colors are never dropped, because a partial list (a remote
 * environment still loading or disconnected) must not shift anything. An empty
 * list is treated as "not loaded yet".
 */
export function syncAssigned(
  state: WorkspaceColorAssignments,
  liveKeys: ReadonlyArray<string>,
): WorkspaceColorAssignments {
  if (liveKeys.length === 0) return state;
  return ensureAssigned(state, liveKeys);
}

export function setOverride(
  state: WorkspaceColorAssignments,
  key: string,
  index: number,
): WorkspaceColorAssignments {
  if (!isValidIndex(index) || state.overrides[key] === index) return state;
  return { ...state, overrides: { ...state.overrides, [key]: index } };
}

export function resetOverride(
  state: WorkspaceColorAssignments,
  key: string,
): WorkspaceColorAssignments {
  if (!(key in state.overrides)) return state;
  const { [key]: _removed, ...overrides } = state.overrides;
  return { ...state, overrides };
}

/** Effective slot for a key: override, else assigned, else a stable hash. */
export function resolveWorkspaceColorIndex(state: WorkspaceColorAssignments, key: string): number {
  const override = state.overrides[key];
  if (isValidIndex(override)) return override;
  const auto = state.assigned[key];
  if (isValidIndex(auto)) return auto;
  return hashWorkspaceColorIndex(key);
}

/** Tint behind a workspace row, derived from its color. */
export function workspaceTintCss(index: number, percent = 12): string {
  return `color-mix(in srgb, ${workspaceColorCss(index)} ${percent}%, transparent)`;
}

/** Context menu entries for changing a workspace color. */
export const WORKSPACE_COLOR_MENU_RESET_ID = "workspace-color:reset";
const WORKSPACE_COLOR_MENU_PREFIX = "workspace-color:";

export function buildWorkspaceColorMenuItem(): {
  id: string;
  label: string;
  children: Array<{ id: string; label: string; separatorBefore?: boolean }>;
} {
  return {
    id: "workspace-color",
    label: "Workspace color",
    children: [
      ...WORKSPACE_COLORS.map((slot, index) => ({
        id: `${WORKSPACE_COLOR_MENU_PREFIX}${index}`,
        label: slot.name,
      })),
      { id: WORKSPACE_COLOR_MENU_RESET_ID, label: "Reset color", separatorBefore: true },
    ],
  };
}

/** Parse a clicked menu id: a slot index, "reset", or null when not ours. */
export function parseWorkspaceColorMenuId(id: string): number | "reset" | null {
  if (id === WORKSPACE_COLOR_MENU_RESET_ID) return "reset";
  if (!id.startsWith(WORKSPACE_COLOR_MENU_PREFIX)) return null;
  const index = Number(id.slice(WORKSPACE_COLOR_MENU_PREFIX.length));
  return isValidIndex(index) ? index : null;
}

function sanitizeIndexMap(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => isValidIndex(entry[1])),
  );
}

/** Drop anything malformed from stored data (null maps, bad indexes). */
export function sanitizePersistedAssignments(persisted: unknown): WorkspaceColorAssignments {
  const record =
    typeof persisted === "object" && persisted !== null
      ? (persisted as { assigned?: unknown; overrides?: unknown })
      : {};
  return {
    assigned: sanitizeIndexMap(record.assigned),
    overrides: sanitizeIndexMap(record.overrides),
  };
}
