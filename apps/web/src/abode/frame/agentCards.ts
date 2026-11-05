import {
  formatWorkingDurationLabel,
  resolveThreadWorkingStartedAt,
} from "@t3tools/client-runtime/state/models";

import { resolveSidebarThreadStatus } from "../../components/Sidebar.logic";
import type { SidebarThreadSummary } from "../../types";
import { deriveWorkspaceThreadState } from "../shell/threadState";
import { threadShellKey } from "../shell/workspaceModel";

type AgentCardStatus = "in-progress" | "needs-you" | "done";

export interface AgentCard {
  readonly key: string;
  readonly environmentId: SidebarThreadSummary["environmentId"];
  readonly threadId: SidebarThreadSummary["id"];
  /** "main" for a top-level thread, else the subagent type ("developer", "reviewer"). */
  readonly name: string;
  /** The ticket ID the work mentions, else the model. */
  readonly meta: string;
  readonly status: AgentCardStatus;
  /** "in progress · 4m", "needs you" or "done". */
  readonly statusLabel: string;
  readonly doing: string;
  /** Whole percent when known; only a finished agent knows it. */
  readonly progress: number | null;
  readonly subagent: boolean;
}

const STATUS_ORDER: Record<AgentCardStatus, number> = {
  "needs-you": 0,
  "in-progress": 1,
  done: 2,
};

const TICKET_ID = /\b[A-Z]{1,3}-\d{2,4}\b/;

function firstLine(text: string | null | undefined): string | null {
  const line = text
    ?.split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ?? null;
}

function ticketIdIn(...texts: ReadonlyArray<string | null | undefined>): string | null {
  for (const text of texts) {
    const match = text === null || text === undefined ? null : TICKET_ID.exec(text);
    if (match) return match[0];
  }
  return null;
}

function cardFor(
  thread: SidebarThreadSummary,
  input: {
    readonly subagent: boolean;
    readonly visitedAt: string | undefined;
    readonly agentType: string | undefined;
    readonly nowMs: number;
  },
): AgentCard | null {
  const { attention } = deriveWorkspaceThreadState(thread, input.visitedAt);
  const status: AgentCardStatus | null =
    attention === "needs-you"
      ? "needs-you"
      : attention === "running"
        ? "in-progress"
        : attention === "done"
          ? "done"
          : null;
  if (status === null) return null;

  const message = firstLine(thread.source?.latestVisibleMessage?.text);
  const startedAt = resolveThreadWorkingStartedAt({
    latestRun: thread.latestRun,
    runtime: thread.runtime,
  });
  const elapsedMs = startedAt === null ? null : input.nowMs - Date.parse(startedAt);
  const waitingText =
    resolveSidebarThreadStatus(thread) === "approval"
      ? "Approval needed"
      : thread.hasPendingUserInput
        ? "Waiting for your answer"
        : "Plan ready for review";
  return {
    key: threadShellKey(thread),
    environmentId: thread.environmentId,
    threadId: thread.id,
    name: input.subagent ? (input.agentType ?? "subagent") : "main",
    meta: ticketIdIn(thread.title, message) ?? thread.modelSelection.model,
    status,
    statusLabel:
      status === "in-progress"
        ? elapsedMs === null || elapsedMs < 0
          ? "in progress"
          : `in progress · ${formatWorkingDurationLabel(elapsedMs)}`
        : status === "needs-you"
          ? "needs you"
          : "done",
    doing:
      status === "needs-you"
        ? waitingText
        : input.subagent
          ? thread.title
          : (message ?? thread.title),
    progress: status === "done" ? 100 : null,
    subagent: input.subagent,
  };
}

/**
 * One card per thread of a workspace that is running, waiting on the user or finished and
 * not yet looked at, and one per live subagent under it. Needs-you cards come first, then
 * running, then done; input order holds inside a group. A subagent's thread shell does not
 * carry its type, so `agentTypeOf` supplies it where the caller has it.
 */
export function agentCards(input: {
  readonly threads: ReadonlyArray<SidebarThreadSummary>;
  readonly subagentsByParentKey: ReadonlyMap<string, ReadonlyArray<SidebarThreadSummary>>;
  readonly visitedAt: (thread: SidebarThreadSummary) => string | undefined;
  readonly agentTypeOf: (thread: SidebarThreadSummary) => string | undefined;
  readonly nowMs: number;
}): AgentCard[] {
  const cards: AgentCard[] = [];
  for (const thread of input.threads) {
    const members = [
      { thread, subagent: false },
      ...(input.subagentsByParentKey.get(threadShellKey(thread)) ?? []).map((child) => ({
        thread: child,
        subagent: true,
      })),
    ];
    for (const member of members) {
      const card = cardFor(member.thread, {
        subagent: member.subagent,
        visitedAt: input.visitedAt(member.thread),
        agentType: input.agentTypeOf(member.thread),
        nowMs: input.nowMs,
      });
      if (card !== null) cards.push(card);
    }
  }
  return cards
    .map((card, index) => ({ card, index }))
    .toSorted(
      (a, b) => STATUS_ORDER[a.card.status] - STATUS_ORDER[b.card.status] || a.index - b.index,
    )
    .map(({ card }) => card);
}

/** The "N agents running" pill. */
export function runningCount(cards: ReadonlyArray<AgentCard>): number {
  return cards.filter((card) => card.status === "in-progress").length;
}
