import {
  browserSurface,
  fileSurface,
  singletonSurface,
  type RightPanelSurface,
  type WorkspaceDrawerApplication,
} from "./rightPanelStore";
import {
  planWorkspaceDrawerRestore,
  type ThreadDrawerSnapshot,
  type WorkspaceDrawerRecord,
  type WorkspaceDrawerTab,
} from "./workspaceDrawerStore";

export interface WorkspaceDrawerRestoreDeps {
  record: WorkspaceDrawerRecord;
  configuredPreviewUrls: ReadonlyArray<string>;
  /** Phone width: the drawer is a sheet that must not pop open by itself. */
  sheetLayout: boolean;
  /** Read live each time it is needed, so a step never acts on a stale view. */
  readThread: () => ThreadDrawerSnapshot;
  terminalHasSessions: () => boolean;
  /** Opens a browser session at the URL and returns its tab id, or null on failure. */
  openBrowserSession: (url: string) => Promise<string | null>;
  applyPanel: (application: WorkspaceDrawerApplication) => void;
  setTerminalOpen: (open: boolean) => void;
  /** True once the thread this restore is for is no longer the open one. */
  isCancelled: () => boolean;
}

const surfaceIdOfTab = (tab: WorkspaceDrawerTab): string | null =>
  tab.kind === "file" ? `file:${tab.relativePath}` : tab.kind === "preview" ? null : tab.kind;

/**
 * Makes a thread show its workspace's remembered drawer. Returns whether the
 * panel was brought in line with the record; `false` means the caller must not
 * treat the thread's current panel as the workspace's choice (sheet layout or
 * a cancelled run).
 *
 * The terminal is set by value: closing is idempotent, and opening only happens
 * when the thread already has terminal sessions (starting one needs the chat
 * view). Nothing here toggles, so an open terminal is never closed by mistake.
 */
export async function restoreWorkspaceDrawer(
  deps: WorkspaceDrawerRestoreDeps,
): Promise<{ applied: boolean }> {
  if (deps.isCancelled()) return { applied: false };
  const plan = planWorkspaceDrawerRestore(
    deps.record,
    deps.readThread(),
    deps.configuredPreviewUrls,
  );
  if (plan.terminal === "close") deps.setTerminalOpen(false);
  else if (plan.terminal === "open" && deps.terminalHasSessions()) deps.setTerminalOpen(true);

  if (!plan.drawerOpen) {
    deps.applyPanel({ isOpen: false, ensure: [], activate: null });
    return { applied: true };
  }
  if (deps.sheetLayout) return { applied: false };

  const ensure: RightPanelSurface[] = [];
  // Changes leads Files, the pair the drawer opens with.
  if (plan.ensureFiles) ensure.push(singletonSurface("changes"), singletonSurface("files"));
  else if (plan.activate?.kind === "changes") ensure.push(singletonSurface("changes"));
  if (plan.activate?.kind === "file") ensure.push(fileSurface(plan.activate.relativePath, null, 0));

  if (plan.openBrowser) {
    if (deps.isCancelled()) return { applied: false };
    const { url } = plan.openBrowser;
    const tabId = url === null ? null : await deps.openBrowserSession(url);
    ensure.push(browserSurface(tabId));
    if (deps.isCancelled()) {
      // The session exists now; keep its tab on that thread, but leave the panel as it was.
      deps.applyPanel({ isOpen: null, ensure: [ensure.at(-1)!], activate: null });
      return { applied: false };
    }
  }

  const activate =
    plan.activate === null
      ? null
      : (surfaceIdOfTab(plan.activate) ??
        (
          ensure.find((surface) => surface.kind === "preview") ??
          deps.readThread().panel.surfaces.find((surface) => surface.kind === "preview")
        )?.id ??
        null);
  deps.applyPanel({ isOpen: true, ensure, activate });
  return { applied: true };
}
