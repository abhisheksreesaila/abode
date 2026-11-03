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

describe("routing edge cases", () => {
  it("does not route by generic or short title words", () => {
    const c = single([
      session("d", "Docs refresh", "auto", "idle"),
      session("f", "Fix login bug", "auto", "idle"),
      session("r", "Run", "auto", "running"),
    ]);
    expect(routeMessage("refresh the page", c)).toMatchObject({
      target: { sessionId: "r" },
      reason: "live session",
    });
    expect(routeMessage("fix this", c).target).toMatchObject({ sessionId: "r" });
    expect(routeMessage("the login is broken", c).target).toMatchObject({ sessionId: "f" });
  });

  it("ignores blank explicit keywords", () => {
    const c = single([
      session("a", "A", "auto", "idle", ["", "  "]),
      session("b", "B", "auto", "running", ["pypi"]),
    ]);
    expect(routeMessage("anything at all", c).target).toMatchObject({ sessionId: "b" });
    expect(routeMessage("push to pypi", c).target).toMatchObject({ sessionId: "b" });
  });

  it("matches Unicode and punctuated keywords", () => {
    const c = single([
      session("a", "A", "auto", "idle", ["café"]),
      session("b", "B", "auto", "idle", ["c++"]),
    ]);
    expect(routeMessage("the café menu", c).target).toMatchObject({ sessionId: "a" });
    expect(routeMessage("port it to C++ now", c).target).toMatchObject({ sessionId: "b" });
    expect(routeMessage("cafés everywhere", c).reason).toBe("first session");
  });

  it("the earliest session wins a tie, and reasons say why", () => {
    const c = single([
      session("a", "A", "auto", "idle", ["deploy"]),
      session("b", "B", "auto", "idle", ["deploy"]),
    ]);
    expect(routeMessage("deploy now", c)).toEqual({
      target: { workspaceKey: "w", sessionId: "a" },
      reason: "keyword: deploy",
    });
    expect(routeMessage("hi", single([session("g", "G", "grill", "waiting")])).reason).toBe(
      "open Grill me",
    );
    expect(routeMessage("hi", single([session("j", "J", "jam", "idle")])).reason).toBe("the jam");
    expect(routeMessage("hi", single([session("n", "N", "auto", "blocked")])).reason).toBe(
      "needs you",
    );
  });

  it("ignores a dangling pin", () => {
    expect(routeMessage("skip docs", ctx({ pinned: "gone" }))).toMatchObject({
      target: { sessionId: "s-docs" },
    });
  });

  it("never switches workspace by name in the workspace view", () => {
    expect(routeMessage("tell git-away to share links", ctx()).target).toMatchObject({
      workspaceKey: "omxcore",
    });
  });

  it("the longest workspace name wins, and short names need a cue", () => {
    const o = ctx({
      view: "overview",
      workspaces: [
        { key: "a", name: "abode", sessions: [session("1", "One", "auto", "idle")] },
        { key: "b", name: "abode-next", sessions: [session("2", "Two", "auto", "idle")] },
        { key: "w", name: "web", sessions: [session("3", "Three", "auto", "idle")] },
      ],
    });
    expect(routeMessage("tell abode-next hello", o).target).toMatchObject({ workspaceKey: "b" });
    expect(routeMessage("the web is slow", o).target).toEqual({ all: true });
    expect(routeMessage("web: hello", o).target).toMatchObject({ workspaceKey: "w" });
    expect(routeMessage("work in web today", o).target).toMatchObject({ workspaceKey: "w" });
  });
});

describe("targetLabel", () => {
  it("says auto unless pinned", () => {
    expect(targetLabel(ctx())).toBe("omxcore · auto");
    expect(targetLabel(ctx({ pinned: "s-docs" }))).toBe("omxcore · Docs refresh");
    expect(targetLabel(ctx({ view: "overview" }))).toBe("all workspaces");
  });
});
