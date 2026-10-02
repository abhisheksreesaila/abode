import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  selectThreadRightPanelState,
  useRightPanelStore,
  type WorkspaceDrawerApplication,
} from "./rightPanelStore";
import type { ThreadDrawerSnapshot, WorkspaceDrawerRecord } from "./workspaceDrawerStore";
import { restoreWorkspaceDrawer, type WorkspaceDrawerRestoreDeps } from "./workspaceDrawerRestore";

const ref = scopeThreadRef("env-1" as EnvironmentId, ThreadId.make("thread-A"));

const record = (overrides: Partial<WorkspaceDrawerRecord> = {}): WorkspaceDrawerRecord => ({
  drawerOpen: true,
  terminalOpen: false,
  activeTab: { kind: "files" },
  browserOpen: true,
  browserUrl: "http://localhost:3000/",
  updatedAt: 1,
  ...overrides,
});

function harness(overrides: Partial<WorkspaceDrawerRestoreDeps> = {}, terminalOpen = false) {
  const calls = {
    applied: [] as WorkspaceDrawerApplication[],
    terminal: [] as boolean[],
    opened: [] as string[],
  };
  const deps: WorkspaceDrawerRestoreDeps = {
    record: record(),
    configuredPreviewUrls: [],
    sheetLayout: false,
    readThread: (): ThreadDrawerSnapshot => ({
      panel: selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, ref),
      terminalOpen,
      browserUrl: null,
    }),
    terminalHasSessions: () => true,
    openBrowserSession: async (url) => {
      calls.opened.push(url);
      return "tab-1";
    },
    applyPanel: (application) => {
      calls.applied.push(application);
      useRightPanelStore.getState().applyWorkspaceDrawer(ref, application);
    },
    setTerminalOpen: (open) => calls.terminal.push(open),
    isCancelled: () => false,
    ...overrides,
  };
  return { deps, calls };
}

beforeEach(() => {
  useRightPanelStore.setState({ byThreadKey: {}, userActionRevisionByThreadKey: {} });
});

describe("restoreWorkspaceDrawer", () => {
  it("brings back files and the browser at its url, with the remembered tab selected", async () => {
    const { deps, calls } = harness();
    expect(await restoreWorkspaceDrawer(deps)).toEqual({ applied: true });
    expect(calls.opened).toEqual(["http://localhost:3000/"]);
    const panel = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, ref);
    expect(panel.isOpen).toBe(true);
    expect(panel.surfaces.map((surface) => surface.id)).toEqual(["files", "browser:tab-1"]);
    expect(panel.activeSurfaceId).toBe("files");
  });

  it("is not a user choice, so proactive panels can still open afterwards", async () => {
    const { deps } = harness();
    const before = useRightPanelStore.getState().getUserActionRevision(ref);
    await restoreWorkspaceDrawer(deps);
    expect(useRightPanelStore.getState().getUserActionRevision(ref)).toBe(before);
    expect(
      useRightPanelStore.getState().openProactive(ref, { id: "diff", kind: "diff" }, before),
    ).toBe(true);
  });

  it("leaves an already-open terminal alone when the workspace wants it open", async () => {
    const { deps, calls } = harness({ record: record({ terminalOpen: true }) }, true);
    await restoreWorkspaceDrawer(deps);
    expect(calls.terminal).toEqual([]);
  });

  it("closes the terminal by value when the workspace left it closed", async () => {
    const { deps, calls } = harness({ record: record({ drawerOpen: false }) }, true);
    await restoreWorkspaceDrawer(deps);
    expect(calls.terminal).toEqual([false]);
  });

  it("opens the terminal only when the thread already has sessions", async () => {
    const withSessions = harness({ record: record({ terminalOpen: true }) });
    await restoreWorkspaceDrawer(withSessions.deps);
    expect(withSessions.calls.terminal).toEqual([true]);
    const without = harness({
      record: record({ terminalOpen: true }),
      terminalHasSessions: () => false,
    });
    await restoreWorkspaceDrawer(without.deps);
    expect(without.calls.terminal).toEqual([]);
  });

  it("does nothing, and opens no browser session, when already cancelled", async () => {
    const { deps, calls } = harness({ isCancelled: () => true });
    expect(await restoreWorkspaceDrawer(deps)).toEqual({ applied: false });
    expect(calls.opened).toEqual([]);
    expect(calls.applied).toEqual([]);
  });

  it("opens no session when cancelled after the plan is made, and keeps the panel as it was if cancelled during the open", async () => {
    let checks = 0;
    const early = harness({ isCancelled: () => ++checks > 1 });
    await restoreWorkspaceDrawer(early.deps);
    expect(early.calls.opened).toEqual([]);

    let cancelled = false;
    const late = harness({
      isCancelled: () => cancelled,
      openBrowserSession: async () => {
        cancelled = true;
        return "tab-9";
      },
    });
    expect(await restoreWorkspaceDrawer(late.deps)).toEqual({ applied: false });
    expect(late.calls.applied).toHaveLength(1);
    expect(late.calls.applied[0]).toMatchObject({ isOpen: null, activate: null });
  });

  it("does not pop the drawer open in sheet layout", async () => {
    const { deps, calls } = harness({ sheetLayout: true });
    expect(await restoreWorkspaceDrawer(deps)).toEqual({ applied: false });
    expect(calls.opened).toEqual([]);
    expect(calls.applied).toEqual([]);
  });

  it("still closes the drawer in sheet layout when the workspace left it closed", async () => {
    const { deps, calls } = harness({ sheetLayout: true, record: record({ drawerOpen: false }) });
    expect(await restoreWorkspaceDrawer(deps)).toEqual({ applied: true });
    expect(calls.applied).toEqual([{ isOpen: false, ensure: [], activate: null }]);
  });

  it("shows the blank browser when the workspace has no url yet", async () => {
    const { deps, calls } = harness({
      record: record({ browserUrl: null, activeTab: { kind: "preview" } }),
    });
    await restoreWorkspaceDrawer(deps);
    expect(calls.opened).toEqual([]);
    const panel = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, ref);
    expect(panel.activeSurfaceId).toBe("browser:new");
  });
});
