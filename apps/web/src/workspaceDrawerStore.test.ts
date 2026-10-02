import { describe, expect, it } from "vite-plus/test";

import type { ThreadRightPanelState } from "./rightPanelStore";
import {
  planWorkspaceDrawerRestore,
  recordFromThread,
  resolveWorkspaceBrowserUrl,
  workspaceDrawerKey,
  type ThreadDrawerSnapshot,
  type WorkspaceDrawerRecord,
} from "./workspaceDrawerStore";

const panel = (overrides: Partial<ThreadRightPanelState> = {}): ThreadRightPanelState => ({
  isOpen: false,
  activeSurfaceId: null,
  surfaces: [],
  ...overrides,
});

const snapshot = (overrides: Partial<ThreadDrawerSnapshot> = {}): ThreadDrawerSnapshot => ({
  panel: panel(),
  terminalOpen: false,
  browserUrl: null,
  ...overrides,
});

const record = (overrides: Partial<WorkspaceDrawerRecord> = {}): WorkspaceDrawerRecord => ({
  drawerOpen: true,
  terminalOpen: false,
  activeTab: { kind: "files" },
  browserOpen: true,
  browserUrl: "http://localhost:3000/",
  updatedAt: 1,
  ...overrides,
});

const filesPanel = panel({
  isOpen: true,
  activeSurfaceId: "files",
  surfaces: [{ id: "files", kind: "files" }],
});
const browserSurface = { id: "browser:t1", kind: "preview", resourceId: "t1" } as const;

describe("workspaceDrawerKey", () => {
  it("separates the same path on two environments", () => {
    expect(workspaceDrawerKey("local", "/a")).not.toBe(workspaceDrawerKey("remote", "/a"));
  });
});

describe("recordFromThread", () => {
  it("captures open state, active tab, terminal and the browser url", () => {
    const next = recordFromThread(
      undefined,
      snapshot({
        panel: panel({
          isOpen: true,
          activeSurfaceId: "browser:t1",
          surfaces: [{ id: "files", kind: "files" }, browserSurface],
        }),
        terminalOpen: true,
        browserUrl: "http://localhost:5173/",
      }),
      5,
    );
    expect(next).toEqual({
      drawerOpen: true,
      terminalOpen: true,
      activeTab: { kind: "preview" },
      browserOpen: true,
      browserUrl: "http://localhost:5173/",
      updatedAt: 5,
    });
  });

  it("keeps the last url when the browser is blank or closed", () => {
    const next = recordFromThread(record(), snapshot({ panel: filesPanel }), 9);
    expect(next.browserUrl).toBe("http://localhost:3000/");
    expect(next.browserOpen).toBe(false);
  });

  it("keeps the remembered tab when the active tab is not one we remember", () => {
    const next = recordFromThread(
      record({ activeTab: { kind: "diff" } }),
      snapshot({
        panel: panel({
          isOpen: true,
          activeSurfaceId: "agents",
          surfaces: [{ id: "agents", kind: "agents" }],
        }),
      }),
      9,
    );
    expect(next.activeTab).toEqual({ kind: "diff" });
  });

  it("returns the same object when nothing changed", () => {
    const previous = record({ browserOpen: false });
    expect(recordFromThread(previous, snapshot({ panel: filesPanel }), 99)).toEqual({
      ...previous,
      drawerOpen: true,
    });
    const same = record({ browserOpen: false });
    expect(recordFromThread(same, snapshot({ panel: filesPanel }), 99)).toBe(same);
  });

  it("remembers a closed drawer", () => {
    const next = recordFromThread(
      record(),
      snapshot({ panel: { ...filesPanel, isOpen: false } }),
      3,
    );
    expect(next.drawerOpen).toBe(false);
    expect(next.activeTab).toEqual({ kind: "files" });
  });
});

describe("resolveWorkspaceBrowserUrl", () => {
  it("prefers the last url, then the configured dev server, then the empty state", () => {
    expect(resolveWorkspaceBrowserUrl("http://a/", ["http://b/"])).toBe("http://a/");
    expect(resolveWorkspaceBrowserUrl(null, ["http://b/", "http://c/"])).toBe("http://b/");
    expect(resolveWorkspaceBrowserUrl(null, [])).toBeNull();
  });
});

describe("planWorkspaceDrawerRestore", () => {
  it("closes the drawer and touches nothing else when the workspace left it closed", () => {
    const plan = planWorkspaceDrawerRestore(
      record({ drawerOpen: false }),
      snapshot({ panel: filesPanel }),
      [],
    );
    expect(plan).toEqual({
      drawerOpen: false,
      ensureFiles: false,
      openBrowser: null,
      activate: null,
      terminal: null,
    });
  });

  it("brings back files and the browser at its url on a fresh thread", () => {
    const plan = planWorkspaceDrawerRestore(record(), snapshot(), []);
    expect(plan.drawerOpen).toBe(true);
    expect(plan.ensureFiles).toBe(true);
    expect(plan.openBrowser).toEqual({ url: "http://localhost:3000/" });
    expect(plan.activate).toEqual({ kind: "files" });
  });

  it("does nothing when the thread already shows the workspace's drawer", () => {
    const thread = snapshot({
      panel: panel({
        isOpen: true,
        activeSurfaceId: "files",
        surfaces: [{ id: "files", kind: "files" }, browserSurface],
      }),
    });
    expect(planWorkspaceDrawerRestore(record(), thread, [])).toEqual({
      drawerOpen: true,
      ensureFiles: false,
      openBrowser: null,
      activate: null,
      terminal: null,
    });
  });

  it("does not reopen a browser the user closed", () => {
    const plan = planWorkspaceDrawerRestore(record({ browserOpen: false }), snapshot(), []);
    expect(plan.openBrowser).toBeNull();
  });

  it("defaults a never-browsed workspace to its configured dev server, else the blank browser", () => {
    const wanted = record({ browserUrl: null, activeTab: { kind: "preview" } });
    expect(
      planWorkspaceDrawerRestore(wanted, snapshot(), ["http://localhost:4000/"]).openBrowser,
    ).toEqual({ url: "http://localhost:4000/" });
    expect(planWorkspaceDrawerRestore(wanted, snapshot(), []).openBrowser).toEqual({ url: null });
  });

  it("reselects the remembered tab when the thread shows another", () => {
    const thread = snapshot({
      panel: panel({
        isOpen: true,
        activeSurfaceId: "diff",
        surfaces: [{ id: "files", kind: "files" }, { id: "diff", kind: "diff" }, browserSurface],
      }),
    });
    expect(planWorkspaceDrawerRestore(record(), thread, []).activate).toEqual({ kind: "files" });
  });

  it("does not create the Files tab when an open file is the remembered tab", () => {
    const plan = planWorkspaceDrawerRestore(
      record({ activeTab: { kind: "file", relativePath: "src/a.ts" }, browserOpen: false }),
      snapshot(),
      [],
    );
    expect(plan.ensureFiles).toBe(false);
    expect(plan.activate).toEqual({ kind: "file", relativePath: "src/a.ts" });
  });

  it("flips the terminal to match the workspace", () => {
    expect(
      planWorkspaceDrawerRestore(record({ terminalOpen: true }), snapshot(), []).terminal,
    ).toBe("open");
    expect(
      planWorkspaceDrawerRestore(
        record({ drawerOpen: false, terminalOpen: false }),
        snapshot({ terminalOpen: true }),
        [],
      ).terminal,
    ).toBe("close");
  });
});
