import type { OrchestrationV2ThreadProjection } from "@t3tools/contracts";
import type { PendingThreadRequests } from "@t3tools/client-runtime/state/thread-requests";

import { deriveActivePlanState } from "~/session-logic";

import { batchRunIds, currentWork } from "../calm/calmCard";
import type { SessionDetail } from "./workspaceRows";

/**
 * Task-list progress of the current batch and the text of what waits on the user,
 * from one session's projection (the same batch rule the Calm card uses).
 */
export function deriveSessionDetail(
  projection: OrchestrationV2ThreadProjection,
  pending: PendingThreadRequests,
): SessionDetail {
  const latestRunId = projection.runs.reduce<(typeof projection.runs)[number] | null>(
    (latest, run) => (latest === null || run.ordinal > latest.ordinal ? run : latest),
    null,
  )?.id;
  const { steps } = currentWork({
    batch: batchRunIds(projection.runs),
    plan: deriveActivePlanState(projection, latestRunId),
    subagents: [],
  });
  const approval = pending.approvals[0];
  const question =
    pending.userInputs[0]?.questions[0]?.question ??
    (approval === undefined ? null : (approval.detail ?? "Waiting for your approval"));
  return {
    progress:
      steps.length === 0
        ? null
        : { done: steps.filter((step) => step.status === "completed").length, total: steps.length },
    question,
  };
}

/** Streamed deltas that change neither the counts nor the question are not news. */
export function sameSessionDetail(left: SessionDetail, right: SessionDetail): boolean {
  return (
    left.question === right.question &&
    left.progress?.done === right.progress?.done &&
    left.progress?.total === right.progress?.total
  );
}
