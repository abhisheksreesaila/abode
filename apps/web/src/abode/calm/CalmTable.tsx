import { derivePendingThreadRequests } from "@t3tools/client-runtime/state/thread-requests";
import type { OrchestrationV2ThreadProjection, ScopedThreadRef } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { useEffect, useRef } from "react";

import { projectScriptCwd } from "@t3tools/shared/projectScripts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";

import ChatMarkdown from "~/components/ChatMarkdown";
import { observeResize } from "~/lib/observeResize";
import { resolveSidebarThreadStatus } from "~/components/Sidebar.logic";
import { deriveActivePlanState } from "~/abode/activePlan";
import { useProject, useThreadProjection, useThreadShell } from "~/state/entities";

import { useTranscriptModeStore } from "../transcript/transcriptModeStore";
import {
  batchRunIds,
  buildPlanTable,
  currentWork,
  formatDuration,
  type PlanRowStatus,
} from "./planTable";
import "./calm.css";

const STATUS_LABEL: Record<PlanRowStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  done: "Done",
  "needs-you": "Needs you",
  waiting: "Waiting",
};

const ms = (value: DateTime.DateTime | null | undefined) =>
  value == null ? null : DateTime.toEpochMillis(value);

/**
 * Calm's session area: no chat, the plan as a table (A-033). Mounted over the timeline in
 * the timeline's own wrapper, which keeps rendering underneath, so Detailed comes back
 * with its scroll position. The composer stays above it, so upstream's question and
 * approval panels work as usual. Static: nothing animates.
 */
export function CalmTable(props: { readonly threadRef: ScopedThreadRef | null }) {
  const calm = useTranscriptModeStore((state) => state.mode === "calm");
  if (!calm || props.threadRef === null) return null;
  return <Loaded threadRef={props.threadRef} />;
}

function Loaded({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const projection = useThreadProjection(threadRef)?.projection ?? null;
  // No runs yet (a thread just created): leave the empty timeline alone.
  if (projection === null || projection.runs.length === 0) return null;
  return <Body threadRef={threadRef} projection={projection} />;
}

function Body({
  threadRef,
  projection,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly projection: OrchestrationV2ThreadProjection;
}) {
  const shell = useThreadShell(threadRef);
  const project = useProject(shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null);
  const cwd = project
    ? projectScriptCwd({
        project: { cwd: project.workspaceRoot },
        worktreePath: shell?.worktreePath ?? null,
      })
    : undefined;
  const status = shell ? resolveSidebarThreadStatus(shell) : null;
  const waiting = status === "approval" || status === "input";
  const pending = derivePendingThreadRequests(projection);
  const needsYou = waiting
    ? (pending.userInputs[0]?.questions[0]?.question ??
      pending.approvals[0]?.detail ??
      (status === "approval" ? "Approval needed" : "Waiting for your answer"))
    : null;

  const batch = batchRunIds(projection.runs);
  const batchRuns = projection.runs.filter((run) => batch.has(run.id));
  const latestRunId = projection.runs.reduce<(typeof projection.runs)[number] | null>(
    (latest, run) => (latest === null || run.ordinal > latest.ordinal ? run : latest),
    null,
  )?.id;
  const work = currentWork({
    batch,
    plan: deriveActivePlanState(projection, latestRunId),
    subagents: projection.subagents,
  });
  const table = buildPlanTable({
    steps: work.steps.map((step) => ({
      step: step.step,
      status: step.status,
      durationMs: step.durationMs,
    })),
    subagents: work.subagents.map((subagent) => ({
      id: subagent.id,
      title: subagent.title ?? "",
      prompt: subagent.prompt,
      agentType: subagent.agentType,
      status: subagent.status,
      startedAtMs: ms(subagent.startedAt),
      completedAtMs: ms(subagent.completedAt),
    })),
    messages: projection.messages,
    batch,
    runs: batchRuns.toSorted((a, b) => a.ordinal - b.ordinal).map((run) => run.status),
    needsYou,
  });

  const startedAt = Math.min(
    ...batchRuns.map((run) => ms(run.workStartedAt ?? run.startedAt) ?? Infinity),
  );
  const finishedAt = Math.max(...batchRuns.map((run) => ms(run.completedAt) ?? 0));
  const took =
    (table.state === "settled" || table.state === "stopped") &&
    Number.isFinite(startedAt) &&
    finishedAt > startedAt
      ? formatDuration(finishedAt - startedAt)
      : null;

  const rootRef = useRef<HTMLElement | null>(null);
  // Keep the last rows clear of the composer, which floats over the bottom of this area.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- observes the floating composer's height and writes it as a bottom inset on the table element
  useEffect(() => {
    const root = rootRef.current;
    const overlay = root?.parentElement?.parentElement?.querySelector<HTMLElement>(
      "[data-chat-composer-overlay]",
    );
    if (!root || !overlay) return;
    const apply = () =>
      root.style.setProperty("--abode-composer-inset", `${overlay.offsetHeight}px`);
    apply();
    return observeResize(overlay, apply);
  }, []);

  const agentsTotal = table.agentsRunning.reduce((sum, agent) => sum + agent.count, 0);
  const agents = table.agentsRunning.map((agent) => `${agent.count} ${agent.type}`).join(", ");

  return (
    <section ref={rootRef} aria-label="Plan" data-abode-calm-table="" data-state={table.state}>
      {table.state === "settled" || table.state === "stopped" ? (
        <div
          data-abode-calm-summary=""
          data-complete={table.complete}
          data-stopped={table.state === "stopped"}
        >
          <div data-abode-calm-summary-head="">
            {table.state === "settled" ? (
              <span data-abode-calm-check="" aria-hidden>
                ✓
              </span>
            ) : null}
            <h2>
              {table.state === "stopped"
                ? table.stopReason === "failed"
                  ? "Failed"
                  : "Stopped"
                : table.progress === null
                  ? "Finished"
                  : table.complete
                    ? `${table.progress.total} of ${table.progress.total} complete`
                    : `${table.progress.done} of ${table.progress.total} done`}
            </h2>
            {took ? <span data-abode-calm-muted="">Took {took}</span> : null}
          </div>
          {table.finalMessage ? (
            <div data-abode-calm-final="">
              <ChatMarkdown text={table.finalMessage} cwd={cwd} threadRef={threadRef} />
            </div>
          ) : null}
        </div>
      ) : (
        <div data-abode-calm-header="">
          {table.progress ? (
            <>
              <div data-abode-calm-percent="">
                <span>{table.progress.percent}%</span>
                <span data-abode-calm-muted="">
                  {table.progress.done} of {table.progress.total} done
                </span>
              </div>
              <div
                data-abode-calm-bar=""
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={table.progress.percent}
              >
                <div style={{ width: `${table.progress.percent}%` }} />
              </div>
            </>
          ) : (
            <div data-abode-calm-percent="">
              <span>Working…</span>
            </div>
          )}
          <div data-abode-calm-meta="">
            <span>{table.state === "needs-you" ? "Waiting for you" : "Running"}</span>
            {agentsTotal > 0 ? (
              <span>
                {agentsTotal} {agentsTotal === 1 ? "agent" : "agents"}: {agents}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {table.needsYou !== null ? (
        <div data-abode-calm-banner="" role="status">
          <span data-abode-calm-badge="">Needs you</span>
          <span data-abode-calm-question="">{table.needsYou}</span>
          <button type="button" onClick={() => answer(rootRef.current)}>
            Answer
          </button>
        </div>
      ) : null}

      {table.rows.length > 0 ? (
        <div data-abode-calm-scroll="">
          <table>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Status</th>
                <th scope="col">Who</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.key} data-status={row.status}>
                  <td data-abode-calm-task="">
                    {row.id ? <span data-abode-calm-id="">{row.id}</span> : null}
                    {row.task}
                  </td>
                  <td data-abode-calm-status="">
                    <span data-abode-calm-pill={row.status}>{STATUS_LABEL[row.status]}</span>
                  </td>
                  <td data-abode-calm-who="">{row.who}</td>
                  <td data-abode-calm-time="">
                    {row.durationMs === null ? "" : formatDuration(row.durationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Opens and focuses upstream's pending question or approval panel in the composer of this
 * thread (found from our own root, not the document). Never focuses a decision button.
 * Couples to upstream's `data-chat-composer-overlay`, `data-chat-composer-form="true"`,
 * `data-pending-user-input-toggle` and `data-approval-detail` (docs/upstream-sync.md).
 */
function answer(root: HTMLElement | null) {
  const overlay = root?.parentElement?.parentElement?.querySelector<HTMLElement>(
    "[data-chat-composer-overlay]",
  );
  const form = overlay?.querySelector<HTMLElement>('[data-chat-composer-form="true"]');
  if (!form) return;
  form.querySelector<HTMLElement>('[data-pending-user-input-toggle="collapsed"]')?.click();
  form.scrollIntoView({ block: "nearest" });
  const target =
    form.querySelector<HTMLElement>("[data-pending-user-input-toggle]") ??
    form.querySelector<HTMLElement>("[data-approval-detail]");
  if (target) {
    target.focus();
    return;
  }
  form.querySelector<HTMLElement>("[contenteditable='true'], textarea")?.focus();
}
