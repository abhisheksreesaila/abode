// Lets the command palette ask the layout panels to toggle without owning
// their state. Sidebar, terminal drawer and right panel each keep their own
// store; their owners subscribe here and run the same code path as the key.
export type PanelToggleTarget = "sidebar" | "terminal" | "rightPanel";

const PANEL_TOGGLE_EVENT = "abode:toggle-panel";

export function requestPanelToggle(target: PanelToggleTarget): void {
  window.dispatchEvent(new CustomEvent<PanelToggleTarget>(PANEL_TOGGLE_EVENT, { detail: target }));
}

export function onPanelToggleRequest(target: PanelToggleTarget, listener: () => void): () => void {
  const handler = (event: Event) => {
    if ((event as CustomEvent<PanelToggleTarget>).detail === target) listener();
  };
  window.addEventListener(PANEL_TOGGLE_EVENT, handler);
  return () => window.removeEventListener(PANEL_TOGGLE_EVENT, handler);
}

// The sidebar's open state used to be written to a cookie nobody read back, so
// it reset on every reload. Persist it in localStorage, defaulting to open.
export const SIDEBAR_OPEN_STORAGE_KEY = "abode:sidebar-open:v1";

export function readPersistedSidebarOpen(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(SIDEBAR_OPEN_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writePersistedSidebarOpen(
  storage: Pick<Storage, "setItem"> | null,
  open: boolean,
): void {
  try {
    storage?.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(open));
  } catch {
    // Storage can be blocked; the toggle still works for this session.
  }
}
