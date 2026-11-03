import { describe, expect, it } from "vite-plus/test";

import {
  buildRouteContext,
  decideSend,
  findSession,
  afterPreviewSend,
  omniboxKeyAction,
  textAfter,
  type CtxWorkspace,
} from "./omniboxLogic";

const pill = (
  key: string,
  title: string,
  over: Partial<CtxWorkspace["sessions"]["pills"][number]> = {},
) => ({ key, title, status: null, running: false, ...over });

const omxcore: CtxWorkspace = {
  key: "omxcore",
  name: "omxcore",
  sessions: {
    pills: [pill("s-docs", "Docs refresh", { running: true }), pill("s-pub", "Publish")],
  },
};
const gitaway: CtxWorkspace = {
  key: "gitaway",
  name: "git-away",
  sessions: { pills: [pill("g-1", "Offline sync", { status: "waiting on you" })] },
};
const empty: CtxWorkspace = { key: "new", name: "newbie", sessions: { pills: [] } };

const input = (over = {}) => ({
  workspaces: [omxcore, gitaway],
  view: "workspace" as const,
  selectedKey: "omxcore",
  pinned: undefined,
  modeOf: () => "auto" as const,
  ...over,
});

describe("buildRouteContext", () => {
  it("maps pill status and running to session state, and asks modeOf per session key", () => {
    const ctx = buildRouteContext(
      input({ modeOf: (k: string) => (k === "g-1" ? "grill" : "auto") }),
    );
    expect(ctx.workspaces).toEqual([
      {
        key: "omxcore",
        name: "omxcore",
        sessions: [
          { id: "s-docs", title: "Docs refresh", mode: "auto", state: "running", keywords: [] },
          { id: "s-pub", title: "Publish", mode: "auto", state: "idle", keywords: [] },
        ],
      },
      {
        key: "gitaway",
        name: "git-away",
        sessions: [
          { id: "g-1", title: "Offline sync", mode: "grill", state: "waiting", keywords: [] },
        ],
      },
    ]);
    expect(ctx.view).toBe("workspace");
    expect(ctx.selectedWorkspaceKey).toBe("omxcore");
  });

  it("maps blocked and landed", () => {
    const ws: CtxWorkspace = {
      key: "w",
      name: "w",
      sessions: {
        pills: [pill("a", "A", { status: "blocked" }), pill("b", "B", { status: "landed" })],
      },
    };
    const states = buildRouteContext(input({ workspaces: [ws] })).workspaces[0]!.sessions.map(
      (s) => s.state,
    );
    expect(states).toEqual(["blocked", "landed"]);
  });
});

describe("findSession", () => {
  it("finds the workspace and pill of a session key", () => {
    expect(findSession([omxcore, gitaway], "g-1")?.workspace.name).toBe("git-away");
    expect(findSession([omxcore, gitaway], "nope")).toBeNull();
  });
});

describe("decideSend", () => {
  const ctx = (over = {}) => buildRouteContext(input(over));

  it("runs a command before routing", () => {
    expect(decideSend("brief me", ctx())).toEqual({
      kind: "command",
      command: { kind: "briefMe" },
    });
  });

  it("sends addToPlan as an instruction to that workspace's routed session", () => {
    expect(decideSend("add dark mode to git-away", ctx())).toEqual({
      kind: "send",
      workspaceKey: "gitaway",
      sessionId: "g-1",
      text: "Add this to docs/plan.md as a ticket: dark mode",
    });
  });

  it("routes plain text to the routed session", () => {
    expect(decideSend("skip docs this release", ctx())).toEqual({
      kind: "send",
      workspaceKey: "omxcore",
      sessionId: "s-docs",
      text: "skip docs this release",
    });
  });

  it("sends to the pinned session", () => {
    expect(decideSend("anything", ctx({ pinned: "g-1" }))).toMatchObject({
      kind: "send",
      workspaceKey: "gitaway",
      sessionId: "g-1",
    });
  });

  it("an empty workspace has no session to send to", () => {
    expect(decideSend("hello", ctx({ workspaces: [empty], selectedKey: "new" }))).toEqual({
      kind: "send",
      workspaceKey: "new",
      sessionId: null,
      text: "hello",
    });
  });

  it("in the overview with no workspace named, previews every workspace's routed session", () => {
    const d = decideSend(
      "stop spending money",
      ctx({ view: "overview", workspaces: [omxcore, gitaway, empty] }),
    );
    expect(d).toEqual({
      kind: "preview",
      text: "stop spending money",
      items: [
        {
          workspaceKey: "omxcore",
          workspaceName: "omxcore",
          sessionId: "s-docs",
          sessionTitle: "Docs refresh",
        },
        {
          workspaceKey: "gitaway",
          workspaceName: "git-away",
          sessionId: "g-1",
          sessionTitle: "Offline sync",
        },
      ],
    });
  });

  it("in the overview, a named workspace is a direct send", () => {
    expect(decideSend("omxcore: ship it", ctx({ view: "overview" }))).toMatchObject({
      kind: "send",
      workspaceKey: "omxcore",
    });
  });
});

describe("omniboxKeyAction", () => {
  const base = {
    key: "",
    mod: false,
    typing: false,
    inOmnibox: false,
    previewOpen: false,
    drawerOpen: false,
    layerOpen: false,
  };
  it("/ focuses the omnibox unless typing elsewhere or modified", () => {
    expect(omniboxKeyAction({ ...base, key: "/" })).toBe("focus");
    expect(omniboxKeyAction({ ...base, key: "/", typing: true })).toBeNull();
    expect(omniboxKeyAction({ ...base, key: "/", mod: true })).toBeNull();
  });
  it("`/` is ignored while typing in any field", () => {
    expect(omniboxKeyAction({ ...base, key: "/", typing: true, inOmnibox: true })).toBeNull();
  });
  it("Esc goes layer, then preview, then drawer, then blur", () => {
    const all = { ...base, key: "Escape", inOmnibox: true, previewOpen: true, drawerOpen: true };
    expect(omniboxKeyAction({ ...all, layerOpen: true })).toBeNull();
    expect(omniboxKeyAction(all)).toBe("close-preview");
    expect(omniboxKeyAction({ ...all, previewOpen: false })).toBe("close-drawer");
    expect(omniboxKeyAction({ ...all, previewOpen: false, drawerOpen: false })).toBe("blur");
    expect(omniboxKeyAction({ ...base, key: "Escape" })).toBeNull();
  });
});

describe("textAfter", () => {
  it("clears on success and keeps the text on failure", () => {
    expect(textAfter("ship it", true)).toBe("");
    expect(textAfter("ship it", false)).toBe("ship it");
  });
});

describe("afterPreviewSend", () => {
  const item = (key: string) => ({
    workspaceKey: key,
    workspaceName: key,
    sessionId: `${key}-1`,
    sessionTitle: "t",
  });
  const items = [item("a"), item("b"), item("c")];
  it("keeps only the failed workspaces and the text", () => {
    const out = afterPreviewSend(items, [true, false, false]);
    expect(out.remaining.map((i) => i.workspaceKey)).toEqual(["b", "c"]);
    expect(out.clearInput).toBe(false);
  });
  it("clears everything when all succeed", () => {
    expect(afterPreviewSend(items, [true, true, true])).toEqual({
      remaining: [],
      clearInput: true,
    });
  });
});
