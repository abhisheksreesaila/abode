import { CheckIcon, ChevronDownIcon } from "lucide-react";

import type { PlanBlock } from "../canvas/planBlock";
import type { Milestone } from "../canvas/plan/parsePlan";
import { useFrameStore } from "./frameStore";
import {
  ageLabel,
  isMilestoneOpen,
  milestoneId,
  milestoneStateWord,
  ticketChip,
} from "./milestonesModel";

const NO_CHOICES: Readonly<Record<string, boolean>> = {};

/**
 * The Milestones tab (A-058): the goal line, then one accordion card per milestone with its
 * tickets. Read-only: the statuses are the agent's, written in docs/plan.md.
 */
export function MilestonesPane(props: {
  readonly block: PlanBlock;
  readonly workspaceKey: string;
  readonly nowMs: number;
  /** Fills the composer without sending; absent when there is nowhere to type. */
  readonly onAskToPlan: (() => void) | undefined;
}) {
  const { block, workspaceKey, nowMs, onAskToPlan } = props;
  const chosen = useFrameStore((state) => state.milestoneOpen[workspaceKey]) ?? NO_CHOICES;
  const changedAt = useFrameStore((state) => state.planSeen[workspaceKey]?.changedAt ?? null);

  if (block.kind === "loading") return null;
  if (block.kind === "error") {
    return (
      <div data-abode-ms="">
        <p data-abode-ms-empty="">Could not read docs/plan.md. {block.message}</p>
      </div>
    );
  }
  if (block.kind === "missing") {
    return (
      <div data-abode-ms="">
        <div data-abode-ms-empty="" data-testid="milestones-empty">
          <p>No plan yet: docs/plan.md is missing or has no milestones.</p>
          <button type="button" disabled={onAskToPlan === undefined} onClick={onAskToPlan}>
            Ask the agent to plan
          </button>
        </div>
      </div>
    );
  }

  const updated = changedAt === null ? "" : ` · updated ${ageLabel(changedAt, nowMs)}`;
  return (
    <div data-abode-ms="" data-testid="milestones">
      <div data-abode-ms-top="">
        {block.goal !== undefined ? (
          <>
            <span data-abode-ms-label="">Goal</span>
            <span data-abode-ms-goal="">{block.goal}</span>
          </>
        ) : null}
        <span data-abode-ms-source="">from docs/plan.md{updated}</span>
      </div>
      {block.rows.map((milestone, index) => (
        <MilestoneCard
          key={milestone.key}
          milestone={milestone}
          index={index}
          open={isMilestoneOpen(milestone, chosen)}
          onToggle={(open) =>
            useFrameStore.getState().setMilestoneOpen(workspaceKey, milestone.key, open)
          }
        />
      ))}
    </div>
  );
}

function MilestoneCard(props: {
  readonly milestone: Milestone;
  readonly index: number;
  readonly open: boolean;
  readonly onToggle: (open: boolean) => void;
}) {
  const { milestone, index, open, onToggle } = props;
  const body = `ms-body-${index}`;
  return (
    <section data-abode-ms-card="" data-state={milestone.state} data-open={open ? "" : undefined}>
      <button
        type="button"
        data-abode-ms-head=""
        aria-expanded={open}
        aria-controls={body}
        onClick={() => onToggle(!open)}
      >
        <span data-abode-ms-id="">{milestoneId(index)}</span>
        <b>{milestone.name}</b>
        <span data-abode-ms-state="">{milestoneStateWord(milestone.state)}</span>
        <span data-abode-ms-bar="" aria-hidden>
          <i style={{ width: `${(milestone.done / milestone.total) * 100}%` }} />
        </span>
        <span data-abode-ms-count="">
          {milestone.done}/{milestone.total}
        </span>
        <ChevronDownIcon aria-hidden data-abode-ms-chevron="" className="size-4" />
      </button>
      {open ? (
        <ul id={body} data-abode-ms-rows="">
          {milestone.tickets.map((ticket) => {
            const chip = ticketChip(ticket);
            return (
              <li key={ticket.id} data-abode-ms-row="" data-testid="milestone-ticket">
                <span data-abode-ms-mark="" data-done={ticket.state === "done" ? "" : undefined}>
                  {ticket.state === "done" ? <CheckIcon aria-hidden className="size-3" /> : null}
                </span>
                <span data-abode-ms-tid="">{ticket.id}</span>
                <span data-abode-ms-title="" data-done={ticket.state === "done" ? "" : undefined}>
                  {ticket.name}
                </span>
                <span data-abode-ms-who="">{ticket.note ?? ""}</span>
                <span data-abode-ms-chip="" data-tone={chip.tone}>
                  {chip.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
