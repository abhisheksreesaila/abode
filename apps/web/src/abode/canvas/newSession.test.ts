import { describe, expect, it } from "vite-plus/test";

import { chooseModel, sessionTitle } from "./newSession";
import { useDrawerStore } from "./drawerStore";

describe("sessionTitle", () => {
  it("uses the first non-empty line", () => {
    expect(sessionTitle("\n  Fix the login bug \nmore detail")).toBe("Fix the login bug");
  });
  it("cuts a long line to 60 characters", () => {
    expect(sessionTitle("x".repeat(80))).toBe(`${"x".repeat(59)}…`);
  });
  it("falls back for an empty message", () => {
    expect(sessionTitle("  ")).toBe("New session");
  });
});

describe("chooseModel", () => {
  it("prefers the project's default", () => {
    expect(chooseModel("project", "fallback")).toBe("project");
    expect(chooseModel(null, "fallback")).toBe("fallback");
    expect(chooseModel(null, null)).toBeNull();
  });
});

describe("new session draft", () => {
  it("opens on a workspace, and opening a session or closing replaces it", () => {
    useDrawerStore.getState().openDraft("ws1");
    expect(useDrawerStore.getState()).toMatchObject({ draftWorkspaceKey: "ws1", sessionKey: null });
    useDrawerStore.getState().open("env:t1");
    expect(useDrawerStore.getState()).toMatchObject({
      draftWorkspaceKey: null,
      sessionKey: "env:t1",
    });
    useDrawerStore.getState().openDraft("ws1");
    useDrawerStore.getState().close();
    expect(useDrawerStore.getState()).toMatchObject({ draftWorkspaceKey: null, sessionKey: null });
  });
});
