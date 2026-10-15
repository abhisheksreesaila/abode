import { deriveThreadTurnSubagents } from "@t3tools/client-runtime/state/thread-subagents";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useMemo } from "react";

import { resolveSidebarThreadStatus } from "~/components/Sidebar.logic";
import { deriveActivePlanState } from "~/session-logic";
import { useThreadProjection, useThreadShell } from "~/state/entities";

import { useTranscriptModeStore } from "../transcript/transcriptModeStore";
import { buildCalmCard } from "./calmCard";
import "./calm.css";

/**
 * Above the composer in Calm mode: tickets done of total, the run's subagents by type,
 * and an orange "Needs you" while an approval or question waits. Static: nothing animates.
 */
export function CalmCard(props: { readonly threadRef: ScopedThreadRef | null }) {
  const calm = useTranscriptModeStore((state) => state.mode === "calm");
  if (!calm || props.threadRef === null) return null;
  return <Card threadRef={props.threadRef} />;
}

function Card({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const shell = useThreadShell(threadRef);
  const projection = useThreadProjection(threadRef)?.projection ?? null;
  const status = shell ? resolveSidebarThreadStatus(shell) : null;
  const needsYou = status === "approval" || status === "input";

  const card = useMemo(() => {
    if (projection === null) return null;
    const turn = deriveThreadTurnSubagents(projection);
    // The newest task list in the thread: the agent keeps one list across its turns.
    const plan = deriveActivePlanState(projection, turn?.runId ?? undefined);
    return buildCalmCard({
      steps: plan?.steps ?? [],
      subagents: turn?.subagents ?? [],
      needsYou,
    });
  }, [projection, needsYou]);
  if (card === null) return null;

  return (
    <section aria-label="Work status" data-abode-calm-card="" data-needs-you={card.needsYou}>
      {card.needsYou ? (
        <p data-abode-calm-alert="" role="status">
          Needs you · answer below
        </p>
      ) : null}
      {card.tickets ? (
        <div data-abode-calm-tickets="">
          <span data-abode-calm-label="">Tickets</span>
          <span data-abode-calm-count="">
            {card.tickets.done} of {card.tickets.total}
          </span>
          <span data-abode-calm-bar="" data-done={card.tickets.allDone} aria-hidden>
            <span style={{ width: `${(card.tickets.done / card.tickets.total) * 100}%` }} />
          </span>
          {card.tickets.allDone ? (
            <span data-abode-calm-check="" aria-label="all done">
              ✓
            </span>
          ) : null}
        </div>
      ) : null}
      {card.agents.length > 0 ? (
        <ul data-abode-calm-agents="">
          {card.agents.map((agent) => (
            <li key={agent.type}>
              <span aria-hidden>{agent.emoji}</span>
              <span data-abode-calm-name="">{agent.type}</span>
              <span data-abode-calm-count="">
                {agent.finished} / {agent.started}
              </span>
              {agent.done ? (
                <span data-abode-calm-check="" aria-label="done">
                  ✓
                </span>
              ) : (
                <span />
              )}
            </li>
          ))}
          {card.moreAgentTypes > 0 ? (
            <li data-abode-calm-more="">+{card.moreAgentTypes} more</li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
