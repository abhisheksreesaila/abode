import {
  foldSubagentActivities,
  isActiveSubagentStatus,
  type RuntimeSubagent,
} from "@t3tools/client-runtime/state/subagentRuntime";
import type { OrchestrationThreadActivity } from "@t3tools/contracts";

/** One nested row under a thread: "↳ type · description". */
export interface SidebarSubagent {
  readonly id: string;
  /** Agent type (the spawn's subagent_type), or null when unknown. */
  readonly type: string | null;
  readonly description: string;
}

/** Rows shown before the tree summarizes the rest as "+N more". */
export const SIDEBAR_SUBAGENT_VISIBLE_LIMIT = 5;

/**
 * Running subagents for a thread, from the activity list the client already
 * holds (the same native fold the Agents panel uses; no extra requests).
 * Only individual agents that are still working show up: workflow
 * coordinators and spawn batches are containers, and anything settled, idle,
 * failed or stopped drops out of the tree.
 */
export function selectRunningSubagents(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
  options?: { readonly sessionLive?: boolean },
): ReadonlyArray<SidebarSubagent> {
  return foldSubagentActivities(activities, options).flatMap((agent) =>
    isRunningLeafAgent(agent) ? [toSidebarSubagent(agent)] : [],
  );
}

function isRunningLeafAgent(agent: RuntimeSubagent): boolean {
  return (
    (agent.kind === "subagent" || agent.kind === "workflow_agent") &&
    isActiveSubagentStatus(agent.status)
  );
}

function toSidebarSubagent(agent: RuntimeSubagent): SidebarSubagent {
  const role = agent.role?.trim() || null;
  const title = agent.title.trim();
  const sameAsTitle = role !== null && role.toLocaleLowerCase() === title.toLocaleLowerCase();
  return {
    id: agent.id,
    type: sameAsTitle ? null : role,
    description: title || role || "Subagent",
  };
}

export function formatSidebarSubagentLabel(agent: SidebarSubagent): string {
  return agent.type ? `${agent.type} · ${agent.description}` : agent.description;
}
