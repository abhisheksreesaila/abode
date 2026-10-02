import type { OrchestrationThreadActivity } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { useAgentFocusStore } from "../../agentFocusStore";
import { formatSidebarSubagentLabel, selectRunningSubagents } from "./sidebarSubagents";

let seq = 0;
function activity(
  kind: string,
  payload: Record<string, unknown>,
  createdAt = new Date(Date.UTC(2026, 9, 1, 12, 0, seq++)).toISOString(),
): OrchestrationThreadActivity {
  return {
    id: `activity-${seq}`,
    tone: "info",
    kind,
    summary: kind,
    payload,
    turnId: null,
    createdAt,
  } as unknown as OrchestrationThreadActivity;
}

function started(taskId: string, description: string, subagentType = "Explore") {
  return activity("task.started", {
    taskId,
    agentKind: "agent",
    title: description,
    role: subagentType,
  });
}

function completed(taskId: string) {
  return activity("task.completed", { taskId, agentKind: "agent", status: "completed" });
}

describe("selectRunningSubagents", () => {
  it("lists running subagents and drops finished ones", () => {
    const rows = selectRunningSubagents([
      started("a", "Find the auth code"),
      started("b", "Check the tests"),
      completed("a"),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["b"]);
  });

  it("shows two concurrent subagents, then none once both finish", () => {
    const running = [started("a", "one"), started("b", "two")];
    expect(selectRunningSubagents(running)).toHaveLength(2);
    expect(selectRunningSubagents([...running, completed("a"), completed("b")])).toEqual([]);
  });

  it("treats agents of a dead session as stopped, not running", () => {
    const rows = selectRunningSubagents([started("a", "one")], { sessionLive: false });
    expect(rows).toEqual([]);
  });

  it("returns nothing for activities that are not subagents", () => {
    expect(selectRunningSubagents([activity("tool.completed", { toolName: "Read" })])).toEqual([]);
  });

  it("formats as type · description", () => {
    const [row] = selectRunningSubagents([started("a", "Find the auth code", "Explore")]);
    expect(row).toBeDefined();
    expect(formatSidebarSubagentLabel(row!)).toBe("Explore · Find the auth code");
  });
});

describe("agent focus store", () => {
  it("re-requests the same agent with a new nonce", () => {
    const { focusAgent } = useAgentFocusStore.getState();
    focusAgent("t1", "a");
    const first = useAgentFocusStore.getState().focusByThreadKey.t1;
    focusAgent("t1", "a");
    const second = useAgentFocusStore.getState().focusByThreadKey.t1;
    expect(second?.agentId).toBe("a");
    expect(second!.nonce).toBeGreaterThan(first!.nonce);
  });

  it("clears a consumed request", () => {
    const store = useAgentFocusStore.getState();
    store.focusAgent("t2", "a");
    store.clearFocus("t2");
    expect(useAgentFocusStore.getState().focusByThreadKey.t2).toBeUndefined();
  });
});
