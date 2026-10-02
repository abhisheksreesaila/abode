import { ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  countThreadActivity,
  decodeCounts,
  encodeCounts,
  formatContextStatus,
  formatProjectHost,
  formatTitleSearchLabel,
  formatUsageStatus,
  needsYouLabel,
  runningLabel,
} from "./statusBar.logic";

const runningSession = {
  threadId: ThreadId.make("thread-1"),
  status: "running" as const,
  providerName: "Codex",
  providerInstanceId: ProviderInstanceId.make("codex"),
  runtimeMode: "full-access" as const,
  activeTurnId: "turn-1" as never,
  lastError: null,
  updatedAt: "2026-03-09T10:00:00.000Z",
};

const idleThread = {
  archivedAt: null,
  hasActionableProposedPlan: false,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  interactionMode: "default" as const,
  latestTurn: null,
  session: null,
  backgroundLiveness: null,
} as never;

function thread(overrides: Record<string, unknown>) {
  return { ...(idleThread as object), ...overrides } as never;
}

describe("countThreadActivity", () => {
  it("counts nothing when no thread is working or waiting", () => {
    expect(countThreadActivity([])).toEqual({ running: 0, needsYou: 0 });
    expect(countThreadActivity([idleThread, idleThread])).toEqual({ running: 0, needsYou: 0 });
  });

  it("counts running sessions and threads that need the user separately", () => {
    const counts = countThreadActivity([
      thread({ session: runningSession }),
      thread({ session: runningSession }),
      thread({ hasPendingApprovals: true }),
      thread({ hasPendingUserInput: true }),
      idleThread,
    ]);
    expect(counts).toEqual({ running: 2, needsYou: 2 });
  });

  it("counts a thread once, under the status that outranks the other", () => {
    const counts = countThreadActivity([
      thread({ session: runningSession, hasPendingApprovals: true }),
    ]);
    expect(counts).toEqual({ running: 0, needsYou: 1 });
  });

  it("skips archived threads", () => {
    const counts = countThreadActivity([
      thread({ session: runningSession, archivedAt: "2026-03-09T10:00:00.000Z" }),
    ]);
    expect(counts).toEqual({ running: 0, needsYou: 0 });
  });

  it("round-trips through the selector encoding", () => {
    expect(decodeCounts(encodeCounts({ running: 3, needsYou: 1 }))).toEqual({
      running: 3,
      needsYou: 1,
    });
  });
});

describe("status bar labels", () => {
  it("words the counts", () => {
    expect(runningLabel(2)).toBe("2 running");
    expect(needsYouLabel(1)).toBe("1 needs you");
  });

  it("joins project and host, leaving out what is unknown", () => {
    expect(formatProjectHost("abode", "laptop")).toBe("abode · laptop");
    expect(formatProjectHost("abode", null)).toBe("abode");
    expect(formatProjectHost(null, "laptop")).toBe("laptop");
    expect(formatProjectHost(null, null)).toBeNull();
    expect(formatProjectHost("", "")).toBeNull();
  });

  it("shows context only when the provider reports it", () => {
    expect(formatContextStatus(38)).toBe("38% ctx");
    expect(formatContextStatus(38.4)).toBe("38% ctx");
    expect(formatContextStatus(4.25)).toBe("4.3% ctx");
    expect(formatContextStatus(null)).toBeNull();
  });

  it("shows the plan and quota nearest its limit, or nothing", () => {
    expect(formatUsageStatus(null)).toBeNull();
    const closest = {
      account: { plan: "Max" },
      window: { usedPercent: 41.6 },
    } as never;
    expect(formatUsageStatus(closest)).toBe("Max 42%");
    const noPlan = { account: { plan: undefined }, window: { usedPercent: 7 } } as never;
    expect(formatUsageStatus(noPlan)).toBe("Usage 7%");
  });

  it("labels the title search with project and thread", () => {
    expect(formatTitleSearchLabel("abode", "Fix the drawer")).toBe("abode — Fix the drawer");
    expect(formatTitleSearchLabel("abode", null)).toBe("abode");
    expect(formatTitleSearchLabel(null, " ")).toBe("Search");
  });
});
