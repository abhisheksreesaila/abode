import { describe, expect, it } from "vite-plus/test";

import { routeMessage, targetLabel, type RouteContext, type RouteSession } from "./routeMessage";

const session = (
  id: string,
  title: string,
  mode: RouteSession["mode"],
  state: RouteSession["state"],
  keywords: string[] = [],
): RouteSession => ({ id, title, mode, state, keywords });

const omxcore = {
  key: "omxcore",
  name: "omxcore",
  sessions: [
    session("s-docs", "Docs refresh", "auto", "running", ["docs", "release notes"]),
    session("s-publish", "Publish", "auto", "waiting", [
      "publish",
      "token",
      "pypi",
      "setup script",
    ]),
  ],
};
const gitaway = {
  key: "gitaway",
  name: "git-away",
  sessions: [
    session("g-1", "Offline sync", "auto", "idle"),
    session("g-2", "Share links", "auto", "running"),
  ],
};

const ctx = (over: Partial<RouteContext> = {}): RouteContext => ({
  view: "workspace",
  selectedWorkspaceKey: "omxcore",
  workspaces: [omxcore, gitaway],
  ...over,
});

const single = (sessions: RouteSession[]): RouteContext => ({
  view: "workspace",
  selectedWorkspaceKey: "w",
  workspaces: [{ key: "w", name: "w", sessions }],
});
const idOf = (c: RouteContext) => {
  const t = routeMessage("hello", c).target;
  return "all" in t ? "all" : t.sessionId;
};

describe("routeMessage", () => {
  it("routes by session keywords", () => {
    expect(routeMessage("skip docs this release", ctx()).target).toEqual({
      workspaceKey: "omxcore",
      sessionId: "s-docs",
    });
    expect(routeMessage("the token's in 1Password, run the setup script", ctx()).target).toEqual({
      workspaceKey: "omxcore",
      sessionId: "s-publish",
    });
  });

  it("matches whole words, case-insensitively", () => {
    // "Documentation" is not the keyword "docs", so this falls back to the waiting session.
    expect(
      idOf(
        single([
          session("a", "x", "auto", "idle", ["docs"]),
          session("b", "y", "auto", "waiting", ["q"]),
        ]),
      ),
    ).toBe("b");
    expect(routeMessage("Documentation looks fine", ctx()).target).toMatchObject({
      sessionId: "s-publish",
    });
    expect(routeMessage("DOCS please", ctx()).target).toMatchObject({ sessionId: "s-docs" });
  });

  it("derives keywords from the title, ignoring stopwords", () => {
    expect(
      routeMessage("make the offline mode faster", ctx({ selectedWorkspaceKey: "gitaway" })).target,
    ).toEqual({ workspaceKey: "gitaway", sessionId: "g-1" });
    // "The plan" yields only "plan"; "the" alone must not count as a keyword hit.
    const c = single([
      session("x", "The plan", "auto", "idle"),
      session("y", "Other", "auto", "running"),
    ]);
    expect(routeMessage("the weather", c).target).toMatchObject({ sessionId: "y" });
  });

  it("a pinned session wins over keywords", () => {
    expect(routeMessage("skip docs this release", ctx({ pinned: "s-publish" }))).toEqual({
      target: { workspaceKey: "omxcore", sessionId: "s-publish" },
      reason: "pinned",
    });
  });

  it("falls back: Grill me, jam, blocked or waiting, running, first", () => {
    const a = session("a", "a", "auto", "idle");
    const b = session("b", "b", "auto", "running");
    const c = session("c", "c", "auto", "blocked");
    const d = session("d", "d", "jam", "running");
    const e = session("e", "e", "grill", "waiting");
    expect(idOf(single([a, b, c, d, e]))).toBe("e");
    expect(idOf(single([a, b, c, d]))).toBe("d");
    expect(idOf(single([a, b, c]))).toBe("c");
    expect(idOf(single([a, b]))).toBe("b");
    expect(idOf(single([a, session("z", "z", "auto", "landed")]))).toBe("a");
  });

  it("a landed Grill me session is not open", () => {
    const landed = session("gl", "Old", "grill", "landed");
    expect(idOf(single([landed, session("r", "r", "auto", "running")]))).toBe("r");
  });

  it("in the overview, targets all workspaces unless one is named", () => {
    const o = ctx({ view: "overview" });
    expect(routeMessage("how is everything", o).target).toEqual({ all: true });
    expect(routeMessage("tell git away to skip the offline part", o).target).toEqual({
      workspaceKey: "gitaway",
      sessionId: "g-1",
    });
    expect(routeMessage("omxcore: the pypi token is ready", o).target).toEqual({
      workspaceKey: "omxcore",
      sessionId: "s-publish",
    });
  });
});

describe("targetLabel", () => {
  it("says auto unless pinned", () => {
    expect(targetLabel(ctx())).toBe("omxcore · auto");
    expect(targetLabel(ctx({ pinned: "s-docs" }))).toBe("omxcore · Docs refresh");
    expect(targetLabel(ctx({ view: "overview" }))).toBe("all workspaces");
  });
});
