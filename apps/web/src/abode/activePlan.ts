import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { RunId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

// Upstream dropped this from session-logic in 0.1.6 (todos became timeline rows); Calm and the Control room still show the plan.
export interface ActivePlanState {
  readonly createdAt: string;
  readonly runId: RunId | null;
  readonly explanation?: string | null;
  readonly steps: Array<{
    readonly step: string;
    readonly status: "pending" | "inProgress" | "completed";
    readonly durationMs?: number;
  }>;
}

export function deriveActivePlanState(
  projection: ThreadStructure | null,
  latestRunId: RunId | undefined,
): ActivePlanState | null {
  if (projection === null) return null;
  const plans = projection.plans
    .filter((plan) => plan.kind === "todo_list")
    .filter((plan) => plan.status !== "superseded");
  const runOrdinals = new Map<RunId | null, number>(
    projection.runs.map((run) => [run.id, run.ordinal]),
  );
  const plan =
    plans.findLast((candidate) => candidate.runId === latestRunId) ??
    plans.reduce<(typeof plans)[number] | null>(
      (latest, candidate) =>
        latest === null ||
        (runOrdinals.get(candidate.runId) ?? -1) >= (runOrdinals.get(latest.runId) ?? -1)
          ? candidate
          : latest,
      null,
    );
  if (plan === null || plan.steps.length === 0) return null;
  return {
    createdAt: planItemTime(projection, plan),
    runId: plan.runId,
    explanation: plan.explanation ?? null,
    steps: plan.steps.map(({ text, status, durationMs }) => ({
      step: text,
      status: status === "running" ? "inProgress" : status,
      ...(durationMs === undefined ? {} : { durationMs }),
    })),
  };
}

function planItemTime(
  projection: ThreadStructure,
  plan: { readonly id: string; readonly runId: RunId | null },
): string {
  const item = projection.turnItems.findLast(
    (candidate) =>
      (candidate.type === "proposed_plan" || candidate.type === "todo_list") &&
      candidate.planId === plan.id,
  );
  if (item?.type === "proposed_plan" || item?.type === "todo_list") {
    return DateTime.formatIso(item.updatedAt);
  }
  const run = projection.runs.find((candidate) => candidate.id === plan.runId);
  return DateTime.formatIso(
    run?.completedAt ?? run?.startedAt ?? run?.requestedAt ?? projection.thread.createdAt,
  );
}
