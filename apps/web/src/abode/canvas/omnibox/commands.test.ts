import { describe, expect, it } from "vite-plus/test";

import { parseCommand } from "./commands";
import type { RouteContext } from "./routeMessage";

const ctx: RouteContext = {
  view: "workspace",
  selectedWorkspaceKey: "omxcore",
  workspaces: [
    {
      key: "omxcore",
      name: "omxcore",
      sessions: [
        { id: "s-docs", title: "Docs refresh", mode: "auto", state: "running", keywords: ["docs"] },
        { id: "s-pub", title: "Publish", mode: "auto", state: "waiting", keywords: ["publish"] },
      ],
    },
    {
      key: "gitaway",
      name: "git-away",
      sessions: [{ id: "g-1", title: "Offline sync", mode: "auto", state: "idle", keywords: [] }],
    },
  ],
};

describe("parseCommand", () => {
  it.each([
    ["put docs on grill me", "s-docs", "grill"],
    ["Put the publish session on tell me", "s-pub", "tell"],
    ["put docs on autopilot", "s-docs", "auto"],
    ["switch docs to jam", "s-docs", "jam"],
  ])("%s sets the mode", (text, sessionId, mode) => {
    expect(parseCommand(text, ctx)).toEqual({ kind: "setMode", sessionId, mode });
  });

  it("finds the session in the selected workspace, or anywhere in the overview", () => {
    expect(parseCommand("put the offline sync on jam", ctx)).toBeNull();
    expect(parseCommand("put the offline sync on jam", { ...ctx, view: "overview" })).toEqual({
      kind: "setMode",
      sessionId: "g-1",
      mode: "jam",
    });
    expect(parseCommand("put nonsense on grill me", ctx)).toBeNull();
  });

  it("adds to a named workspace's plan", () => {
    expect(parseCommand("add a milestone for share links to git away", ctx)).toEqual({
      kind: "addToPlan",
      workspaceKey: "gitaway",
      text: "a milestone for share links",
    });
    expect(parseCommand("add retry to the logic to omxcore", ctx)).toEqual({
      kind: "addToPlan",
      workspaceKey: "omxcore",
      text: "retry to the logic",
    });
    expect(parseCommand("add dark mode to nowhere", ctx)).toBeNull();
    expect(parseCommand("add a retry to the git-away sync", ctx)).toBeNull();
    expect(parseCommand("add a ticket to the git-away plan", ctx)).toEqual({
      kind: "addToPlan",
      workspaceKey: "gitaway",
      text: "a ticket",
    });
    expect(parseCommand("add a ticket to omxcore's plan.", ctx)).toMatchObject({
      workspaceKey: "omxcore",
    });
    expect(parseCommand("add a ticket to omxcore's docs/plan.md", ctx)).toMatchObject({
      workspaceKey: "omxcore",
    });
  });

  it("creates a workspace, with an optional goal", () => {
    expect(parseCommand("new workspace Mojo UI, goal: ship a Mojo widget kit", ctx)).toEqual({
      kind: "newWorkspace",
      name: "Mojo UI",
      goal: "ship a Mojo widget kit",
    });
    expect(parseCommand("New workspace billing", ctx)).toEqual({
      kind: "newWorkspace",
      name: "billing",
    });
    expect(parseCommand("New workspace permissions are wrong", ctx)).toBeNull();
    expect(parseCommand("new workspace one two three four", ctx)).toBeNull();
  });

  it("recognises brief me and tour", () => {
    expect(parseCommand("Brief me", ctx)).toEqual({ kind: "briefMe" });
    expect(parseCommand("brief me.", ctx)).toEqual({ kind: "briefMe" });
    expect(parseCommand("tour", ctx)).toEqual({ kind: "tour" });
    expect(parseCommand("?", ctx)).toEqual({ kind: "tour" });
  });

  it("returns null for anything else so it falls through to routing", () => {
    expect(parseCommand("skip docs this release", ctx)).toBeNull();
    expect(parseCommand("brief me on the docs plan please", ctx)).toBeNull();
    expect(parseCommand("", ctx)).toBeNull();
  });
});
