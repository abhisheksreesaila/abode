import { describe, expect, it } from "vite-plus/test";

import type {
  EnvironmentId,
  MessageId,
  ModelSelection,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";

import { buildStartSession, chooseModel, sessionTitle } from "./newSession";
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

describe("buildStartSession", () => {
  const model = { instanceId: "claude", model: "opus" } as unknown as ModelSelection;
  const other = { instanceId: "codex", model: "gpt" } as unknown as ModelSelection;
  const base = {
    project: { environmentId: "env" as EnvironmentId, id: "p1" as ProjectId },
    projectModel: model,
    fallbackModel: other,
    text: "  Fix login\nplease ",
    threadId: "t1" as ThreadId,
    messageId: "m1" as MessageId,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("is one approval-required command that creates the thread with the first message", () => {
    expect(buildStartSession(base)).toEqual({
      error: null,
      environmentId: "env",
      input: {
        threadId: "t1",
        message: { messageId: "m1", role: "user", text: "Fix login\nplease", attachments: [] },
        modelSelection: model,
        titleSeed: "Fix login",
        runtimeMode: "approval-required",
        interactionMode: "default",
        bootstrap: {
          createThread: {
            projectId: "p1",
            title: "Fix login",
            modelSelection: model,
            runtimeMode: "approval-required",
            interactionMode: "default",
            branch: null,
            worktreePath: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });
  it("uses the fallback model when the project has none", () => {
    const command = buildStartSession({ ...base, projectModel: null });
    expect(command.error === null && command.input.modelSelection).toBe(other);
  });
  it("says why it cannot start", () => {
    expect(buildStartSession({ ...base, text: "  " }).error).toBe(
      "Write a first message to start a session.",
    );
    expect(buildStartSession({ ...base, project: undefined }).error).toBe(
      "This workspace has no project to start a session in.",
    );
    expect(buildStartSession({ ...base, projectModel: null, fallbackModel: null }).error).toBe(
      "No model is available to start a session.",
    );
  });
});

it("tracks one session start at a time", () => {
  useDrawerStore.getState().setStarting(true);
  expect(useDrawerStore.getState().starting).toBe(true);
  useDrawerStore.getState().setStarting(false);
  expect(useDrawerStore.getState().starting).toBe(false);
});
