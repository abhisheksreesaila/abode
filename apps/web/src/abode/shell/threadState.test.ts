import { describe, expect, it } from "vite-plus/test";

import { deriveWorkspaceThreadState } from "./threadState";

type Input = Parameters<typeof deriveWorkspaceThreadState>[0];

const thread = (overrides: Record<string, unknown> = {}): Input =>
  ({
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    latestRun: null,
    runtime: null,
    lastVisitedAt: null,
    pendingBackgroundTasks: [],
    ...overrides,
  }) as unknown as Input;

describe("deriveWorkspaceThreadState", () => {
  it("is quiet for an idle thread", () => {
    expect(deriveWorkspaceThreadState(thread(), undefined)).toEqual({
      attention: null,
      failed: false,
    });
  });

  it("reports a running thread as Working", () => {
    expect(
      deriveWorkspaceThreadState(thread({ runtime: { status: "running" } }), undefined),
    ).toEqual({ attention: "running", failed: false });
  });

  it("reports approvals and questions as needing the user", () => {
    expect(
      deriveWorkspaceThreadState(thread({ hasPendingApprovals: true }), undefined).attention,
    ).toBe("needs-you");
    expect(
      deriveWorkspaceThreadState(thread({ hasPendingUserInput: true }), undefined).attention,
    ).toBe("needs-you");
  });

  it("treats a plan waiting for approval as needing the user", () => {
    expect(
      deriveWorkspaceThreadState(
        thread({
          interactionMode: "plan",
          hasActionableProposedPlan: true,
          latestRun: { runId: "r1", completedAt: "2026-10-10T10:00:00.000Z", status: "completed" },
          runtime: { status: "idle" },
        }),
        undefined,
      ).attention,
    ).toBe("needs-you");
  });

  it("marks a failed run, including one stopped by a usage limit", () => {
    expect(
      deriveWorkspaceThreadState(thread({ runtime: { status: "failed" } }), undefined).failed,
    ).toBe(true);
    expect(
      deriveWorkspaceThreadState(
        thread({ runtime: { status: "failed", lastErrorClass: "usage_limit" } }),
        undefined,
      ).failed,
    ).toBe(true);
  });

  it("calls a finished run Completed only until it has been visited", () => {
    const finished = {
      latestRun: { completedAt: "2026-10-10T10:00:00.000Z" },
      runtime: { status: "idle" },
    };
    expect(
      deriveWorkspaceThreadState(
        thread({ ...finished, lastVisitedAt: "2026-10-10T09:00:00.000Z" }),
        undefined,
      ).attention,
    ).toBe("done");
    expect(
      deriveWorkspaceThreadState(
        thread({ ...finished, lastVisitedAt: "2026-10-10T11:00:00.000Z" }),
        undefined,
      ).attention,
    ).toBeNull();
  });

  it("uses the browser's own visit time when the server does not track visits", () => {
    const finished = {
      latestRun: { completedAt: "2026-10-10T10:00:00.000Z" },
      runtime: { status: "idle" },
      lastVisitedAt: undefined,
    };
    expect(deriveWorkspaceThreadState(thread(finished), "2026-10-10T09:00:00.000Z").attention).toBe(
      "done",
    );
    expect(
      deriveWorkspaceThreadState(thread(finished), "2026-10-10T12:00:00.000Z").attention,
    ).toBeNull();
  });
});
