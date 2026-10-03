/**
 * Per-workspace right-drawer memory.
 *
 * The right panel and bottom terminal keep their state per thread, but a user
 * thinks in workspaces: switching to a workspace should bring back the drawer
 * they left there (open or closed, which tab, which browser URL) whichever
 * thread they land on. This store holds one small record per workspace; the
 * thread stores stay the source of truth for what is rendered. `WorkspaceDrawerSync`
 * copies thread state into the record as the user changes it, and applies the
 * record to a thread when it becomes the open one.
 *
 * A workspace is identified by `${environmentId}:${workspaceRoot}`, so the same
 * path on two machines gets two drawers.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";
import type { ThreadRightPanelState } from "./rightPanelStore";

export const WORKSPACE_DRAWER_STORAGE_KEY = "abode:workspace-drawer:v1";
const WORKSPACE_DRAWER_MAX_RECORDS = 100;

export type WorkspaceDrawerTab =
  | { kind: "changes" }
  | { kind: "files" }
  | { kind: "diff" }
  | { kind: "preview" }
  | { kind: "file"; relativePath: string };

export interface WorkspaceDrawerRecord {
  drawerOpen: boolean;
  terminalOpen: boolean;
  activeTab: WorkspaceDrawerTab | null;
  /** The workspace wants a browser tab in its drawer (false once the user closes it). */
  browserOpen: boolean;
  /** Last URL the workspace's browser showed. */
  browserUrl: string | null;
  updatedAt: number;
}

export function workspaceDrawerKey(environmentId: string, workspaceRoot: string): string {
  return `${environmentId}:${workspaceRoot}`;
}

function tabOfSurface(
  surface: ThreadRightPanelState["surfaces"][number] | undefined,
): WorkspaceDrawerTab | null {
  if (!surface) return null;
  switch (surface.kind) {
    case "changes":
    case "files":
    case "diff":
    case "preview":
      return { kind: surface.kind };
    case "file":
      return surface.attachment ? null : { kind: "file", relativePath: surface.relativePath };
    default:
      return null;
  }
}

function sameTab(a: WorkspaceDrawerTab | null, b: WorkspaceDrawerTab | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === "file" && b.kind === "file" ? a.relativePath === b.relativePath : true;
}

export interface ThreadDrawerSnapshot {
  panel: ThreadRightPanelState;
  terminalOpen: boolean;
  /** URL of the thread's active browser tab, or null when none or still blank. */
  browserUrl: string | null;
}

/** Folds what a thread currently shows into the workspace's record. */
export function recordFromThread(
  previous: WorkspaceDrawerRecord | undefined,
  snapshot: ThreadDrawerSnapshot,
  now: number,
): WorkspaceDrawerRecord {
  const { panel } = snapshot;
  const active = panel.surfaces.find((surface) => surface.id === panel.activeSurfaceId);
  const next: WorkspaceDrawerRecord = {
    drawerOpen: panel.isOpen,
    terminalOpen: snapshot.terminalOpen,
    // Tabs we do not remember (device, pull requests, ...) leave the old choice alone.
    activeTab: tabOfSurface(active) ?? previous?.activeTab ?? null,
    browserOpen: panel.surfaces.some((surface) => surface.kind === "preview"),
    browserUrl: snapshot.browserUrl ?? previous?.browserUrl ?? null,
    updatedAt: now,
  };
  if (
    previous &&
    previous.drawerOpen === next.drawerOpen &&
    previous.terminalOpen === next.terminalOpen &&
    previous.browserOpen === next.browserOpen &&
    previous.browserUrl === next.browserUrl &&
    sameTab(previous.activeTab, next.activeTab)
  ) {
    return previous;
  }
  return next;
}

/**
 * Where a workspace's browser should go. The last URL used there wins (it was
 * itself defaulted from the dev server the first time); a configured dev-server
 * preview URL covers a workspace that has not been browsed yet. Null shows the
 * browser's empty state, which lists recent and discovered servers.
 */
export function resolveWorkspaceBrowserUrl(
  savedUrl: string | null,
  configuredPreviewUrls: ReadonlyArray<string>,
): string | null {
  return savedUrl ?? configuredPreviewUrls[0] ?? null;
}

export interface WorkspaceDrawerRestorePlan {
  /** Whether the drawer should end up open. */
  drawerOpen: boolean;
  /** Open (and so create) the Files tab. */
  ensureFiles: boolean;
  /** Open a browser: `url` null means the blank browser with its empty state. */
  openBrowser: { url: string | null } | null;
  /** Tab to leave selected, when it differs from what the thread shows. */
  activate: WorkspaceDrawerTab | null;
  /** Terminal needs flipping to match the workspace. */
  terminal: "open" | "close" | null;
}

/** What to do to a thread so it shows its workspace's drawer. Empty plan when it already does. */
export function planWorkspaceDrawerRestore(
  record: WorkspaceDrawerRecord,
  thread: ThreadDrawerSnapshot,
  configuredPreviewUrls: ReadonlyArray<string>,
): WorkspaceDrawerRestorePlan {
  const terminal =
    record.terminalOpen === thread.terminalOpen ? null : record.terminalOpen ? "open" : "close";
  if (!record.drawerOpen) {
    return { drawerOpen: false, ensureFiles: false, openBrowser: null, activate: null, terminal };
  }
  const { panel } = thread;
  const hasBrowser = panel.surfaces.some((surface) => surface.kind === "preview");
  const hasFiles = panel.surfaces.some((surface) => surface.kind === "files");
  const url = resolveWorkspaceBrowserUrl(record.browserUrl, configuredPreviewUrls);
  const wantsBrowser = record.browserOpen || record.activeTab?.kind === "preview";
  const active = panel.surfaces.find((surface) => surface.id === panel.activeSurfaceId);
  const currentTab = panel.isOpen ? tabOfSurface(active) : null;
  return {
    drawerOpen: true,
    ensureFiles: !hasFiles && record.activeTab?.kind !== "file",
    openBrowser: !hasBrowser && wantsBrowser ? { url } : null,
    activate: sameTab(currentTab, record.activeTab) ? null : record.activeTab,
    terminal,
  };
}

interface WorkspaceDrawerStoreState {
  byWorkspaceKey: Record<string, WorkspaceDrawerRecord>;
  setRecord: (workspaceKey: string, record: WorkspaceDrawerRecord) => void;
}

function trimRecords(
  byWorkspaceKey: Record<string, WorkspaceDrawerRecord>,
): Record<string, WorkspaceDrawerRecord> {
  const entries = Object.entries(byWorkspaceKey);
  if (entries.length <= WORKSPACE_DRAWER_MAX_RECORDS) return byWorkspaceKey;
  return Object.fromEntries(
    entries
      .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, WORKSPACE_DRAWER_MAX_RECORDS),
  );
}

export const useWorkspaceDrawerStore = create<WorkspaceDrawerStoreState>()(
  persist(
    (set) => ({
      byWorkspaceKey: {},
      setRecord: (workspaceKey, record) =>
        set((state) =>
          state.byWorkspaceKey[workspaceKey] === record
            ? state
            : { byWorkspaceKey: trimRecords({ ...state.byWorkspaceKey, [workspaceKey]: record }) },
        ),
    }),
    {
      name: WORKSPACE_DRAWER_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ byWorkspaceKey: state.byWorkspaceKey }),
    },
  ),
);
