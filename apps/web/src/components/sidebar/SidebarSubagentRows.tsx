import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { isThreadSessionRunning } from "@t3tools/client-runtime/state/threads";
import { useNavigate } from "@tanstack/react-router";
import * as Option from "effect/Option";
import { memo, useCallback, useMemo } from "react";

import { useAgentFocusStore } from "../../agentFocusStore";
import { buildThreadRouteParams } from "../../threadRoutes";
import { useRightPanelStore } from "../../rightPanelStore";
import { derivePhase } from "../../session-logic";
import { useEnvironmentThread } from "../../state/threads";
import type { SidebarThreadSummary } from "../../types";
import { resolveSidebarThreadStatus } from "../Sidebar.logic";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  SIDEBAR_SUBAGENT_VISIBLE_LIMIT,
  formatSidebarSubagentLabel,
  selectRunningSubagents,
  type SidebarSubagent,
} from "./sidebarSubagents";

/**
 * Running subagents nested under a thread row: "↳ type · description" with a
 * static status dot (abode F-008). Nothing here opens a new subscription for a
 * quiet thread: the detail stream is only read while the thread is working or
 * open, which is when the client already holds it. Finished subagents drop
 * out of the list, so a thread with none renders nothing.
 */
export const SidebarSubagentRows = memo(function SidebarSubagentRows(props: {
  readonly thread: SidebarThreadSummary;
  readonly isActive: boolean;
  /** Workspace color (CSS) for the guide line; omitted to use the muted tone. */
  readonly guideColor?: string | undefined;
  /** Wrap the list in an <li>, for rows that live inside a <ul>. */
  readonly asListItem?: boolean | undefined;
}) {
  const { thread, isActive } = props;
  const mayHaveRunningAgents =
    isActive ||
    isThreadSessionRunning(thread.session) ||
    resolveSidebarThreadStatus(thread) === "working" ||
    resolveSidebarThreadStatus(thread) === "monitoring";
  if (!mayHaveRunningAgents) return null;
  return <RunningSubagentList {...props} />;
});

function RunningSubagentList({
  thread,
  guideColor,
  asListItem,
}: {
  readonly thread: SidebarThreadSummary;
  readonly isActive: boolean;
  readonly guideColor?: string | undefined;
  readonly asListItem?: boolean | undefined;
}) {
  const state = useEnvironmentThread(thread.environmentId, thread.id);
  const activities = Option.match(state.data, {
    onNone: () => null,
    onSome: (detail) => detail.activities,
  });
  const sessionLive = derivePhase(thread.session) !== "disconnected";
  const agents = useMemo(
    () => (activities === null ? [] : selectRunningSubagents(activities, { sessionLive })),
    [activities, sessionLive],
  );
  const navigate = useNavigate();
  const threadRef = useMemo(
    () => scopeThreadRef(thread.environmentId, thread.id),
    [thread.environmentId, thread.id],
  );
  const openAgent = useCallback(
    (agentId: string) => {
      useRightPanelStore.getState().open(threadRef, "agents");
      useAgentFocusStore.getState().focusAgent(scopedThreadKey(threadRef), agentId);
      void navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
      });
    },
    [navigate, threadRef],
  );

  if (agents.length === 0) return null;
  const visible = agents.slice(0, SIDEBAR_SUBAGENT_VISIBLE_LIMIT);
  const hidden = agents.length - visible.length;
  const list = (
    <ul
      aria-label="Running subagents"
      className="mb-0.5 ml-4 flex flex-col border-l pl-1.5"
      style={{ borderLeftColor: guideColor ?? "var(--border)" }}
    >
      {visible.map((agent) => (
        <SubagentRow key={agent.id} agent={agent} onOpen={openAgent} />
      ))}
      {hidden > 0 ? (
        <li className="px-1.5 py-0.5 text-3xs text-muted-foreground">+{hidden} more</li>
      ) : null}
    </ul>
  );
  return asListItem ? <li className="w-full">{list}</li> : list;
}

function SubagentRow({
  agent,
  onOpen,
}: {
  readonly agent: SidebarSubagent;
  readonly onOpen: (agentId: string) => void;
}) {
  const label = formatSidebarSubagentLabel(agent);
  return (
    <li>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => onOpen(agent.id)}
              className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            />
          }
        >
          <span aria-hidden>↳</span>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-info" />
          <span className="min-w-0 truncate">{label}</span>
          <span className="sr-only">running</span>
        </TooltipTrigger>
        <TooltipPopup side="right">{label}</TooltipPopup>
      </Tooltip>
    </li>
  );
}
