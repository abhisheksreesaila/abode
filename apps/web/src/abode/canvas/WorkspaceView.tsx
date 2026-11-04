import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { useState } from "react";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";

import { useRemovedWorkspacesStore } from "../shell/workspaceRemovedStore";
import { useDrawerStore } from "./drawerStore";
import { composeBlocks, composeSessions, type Block } from "./composeBlocks";
import { JourneyMap } from "./JourneyMap";
import { ModeBlock } from "./ModeBlocks";
import { ModeButton } from "./ModeButton";
import { planBlock, type PlanBlock } from "./planBlock";
import type { Milestone, Ticket } from "./plan/parsePlan";
import { modeOf, useSessionModeStore } from "./sessionModeStore";
import type { SessionMode } from "./sessionMode";
import type { SessionPill } from "./sessionPills";
import { useFreshMoment } from "./useFreshMoment";
import { usePlanFile } from "./usePlanFile";
import type { CanvasWorkspace } from "./useCanvasWorkspaces";

function Pill(props: {
  readonly pill: SessionPill;
  readonly mode: SessionMode;
  /** Just created: the focus moment's amber ring (spec 5.11). */
  readonly fresh?: boolean;
  readonly onOpen: () => void;
}) {
  const { pill, mode, onOpen } = props;
  return (
    <div
      data-cv-sc=""
      data-mode={mode}
      data-cv-new={props.fresh ? "" : undefined}
      role="group"
      aria-label={pill.title}
    >
      <ModeButton pill={pill} mode={mode} />
      <button type="button" data-cv-open="" onClick={onOpen}>
        <b>{pill.title}</b>
        <span data-cv-mt="" aria-hidden>
          {pill.dots.map((provider, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- dots have no identity beyond position
            <span key={index} data-cv-mt-part="">
              {index === 1 ? <em>→</em> : null}
              <i data-provider={provider} />
            </span>
          ))}
        </span>
        {pill.status !== null ? (
          <span data-cv-sw="" data-status={pill.status === "landed" ? "landed" : undefined}>
            {pill.status}
          </span>
        ) : null}
      </button>
    </div>
  );
}

const GLYPH: Record<Ticket["state"], string> = {
  done: "✓",
  running: "●",
  stopped: "‖",
  failed: "✕",
  todo: "○",
};

// Stable identity, so it runs when the row mounts and not on every refresh.
function showAtTop(row: HTMLDivElement | null) {
  const area = row?.parentElement;
  if (row && area)
    area.scrollTop += row.getBoundingClientRect().top - area.getBoundingClientRect().top;
}

function MilestoneRow(props: { readonly milestone: Milestone }) {
  const { milestone } = props;
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? milestone.state === "current";
  return (
    <div
      data-cv-ms=""
      data-state={milestone.state}
      ref={milestone.state === "current" ? showAtTop : undefined}
    >
      <button
        type="button"
        data-cv-mh=""
        aria-expanded={expanded}
        onClick={() => setOpen(!expanded)}
      >
        <i data-cv-mi="" aria-hidden />
        <b>{milestone.name}</b>
        <span data-cv-ct="">
          {milestone.done}/{milestone.total}
        </span>
      </button>
      <div data-cv-mbody="" data-open={expanded ? "" : undefined}>
        <ul>
          {milestone.tickets.map((ticket) => (
            <li key={ticket.id} data-state={ticket.state}>
              <span data-cv-ic="" aria-hidden>
                {GLYPH[ticket.state]}
              </span>
              <span data-cv-tn="">{ticket.name}</span>
              {ticket.note ? <span data-cv-nt="">{ticket.note}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlanBody(props: { readonly block: PlanBlock }) {
  const { block } = props;
  if (block.kind === "loading") {
    return (
      <div data-cv-plan-skel="" aria-busy aria-label="Loading plan">
        <i />
        <i />
        <i />
      </div>
    );
  }
  if (block.kind === "missing") return <p data-cv-plan-note="">no plan yet</p>;
  if (block.kind === "error") {
    return <p data-cv-plan-note="">Could not read the plan: {block.message}</p>;
  }
  return (
    <>
      {block.goal ? <p data-cv-goal="">Goal: {block.goal}</p> : null}
      {block.rows.map((milestone) => (
        <MilestoneRow key={milestone.key} milestone={milestone} />
      ))}
    </>
  );
}

/** The selected workspace: its name and menu, then one pill per live session, "N done" and "+". */
export function WorkspaceView(props: {
  readonly workspace: CanvasWorkspace;
  /** Phone only: back to the workspace list. */
  readonly onBack?: (() => void) | undefined;
}) {
  const { workspace, onBack } = props;
  const handleNewThread = useNewThreadHandler();
  const [showDone, setShowDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const { pills, done, doneCount } = workspace.sessions;
  const root = workspace.newSessionTarget;
  const planFile = usePlanFile(root?.environmentId, root?.workspaceRoot, workspace.turnSignal);
  const plan: PlanBlock = planFile.pending ? { kind: "loading" } : planBlock(planFile);
  const modes = useSessionModeStore((state) => state.modes);
  const sessions = composeSessions(pills, modes);
  const rows = composeBlocks(sessions);
  const freshSession = useFreshMoment(
    workspace.key,
    pills.map((pill) => pill.key),
  );
  const fresh = creating || freshSession !== null;

  const renderBlock = (block: Block) => {
    if (block.block === "plan") {
      return (
        <section key="plan" data-cv-plan="" aria-label="Plan">
          <PlanBody block={plan} />
        </section>
      );
    }
    if (block.block === "side") {
      return (
        <div key="side" data-cv-side="">
          {block.items.map((item) => renderBlock(item))}
        </div>
      );
    }
    const key = "sessionKey" in block ? `${block.block}:${block.sessionKey}` : block.block;
    return <ModeBlock key={key} block={block} pills={pills} sessions={sessions} onOpen={open} />;
  };

  // A session opens in the chat drawer; the full thread route is reached from the drawer only.
  const open = (pill: SessionPill) => useDrawerStore.getState().open(pill.key);

  const addSession = async () => {
    const target = workspace.newSessionTarget;
    if (target === undefined) return;
    setCreating(true);
    // No options: branch, worktree and env mode come from the user's defaults, like the sidebar's "+".
    const result = await settlePromise(() =>
      handleNewThread(scopeProjectRef(target.environmentId, target.id)),
    );
    setCreating(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not create session",
          description: error instanceof Error ? error.message : "An error occurred.",
        }),
      );
    }
  };

  return (
    <div data-cv-ws="" data-fresh={fresh ? "" : undefined}>
      <div data-cv-head="">
        {onBack ? (
          <button type="button" data-cv-back="" onClick={onBack}>
            ← workspaces
          </button>
        ) : null}
        <h2>{workspace.name}</h2>
        <Menu>
          <MenuTrigger data-cv-xbtn="" aria-label="Workspace menu">
            …
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem
              onClick={() => useRemovedWorkspacesStore.getState().setRemoved(workspace.key, true)}
            >
              Hide workspace
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      <div data-cv-sess="" aria-label="Sessions" role="group">
        {pills.map((pill) => (
          <Pill
            key={pill.key}
            pill={pill}
            mode={modeOf(modes, pill.key)}
            fresh={pill.key === freshSession}
            onOpen={() => open(pill)}
          />
        ))}
        {showDone
          ? done.map((pill) => (
              <Pill
                key={pill.key}
                pill={pill}
                mode={modeOf(modes, pill.key)}
                onOpen={() => open(pill)}
              />
            ))
          : null}
        {doneCount > 0 ? (
          <button
            type="button"
            data-cv-sc=""
            data-cv-more=""
            aria-expanded={showDone}
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? "hide" : doneCount} done
          </button>
        ) : null}
        <button
          type="button"
          data-cv-sc=""
          data-cv-add-session=""
          aria-label="New session"
          onClick={() => void addSession()}
        >
          +
        </button>
      </div>
      {plan.kind === "ready" ? <JourneyMap plan={plan} sessions={sessions} /> : null}
      {rows.map((row, index) => (
        <div
          // oxlint-disable-next-line react/no-array-index-key -- rows are recomposed from the modes; position is their identity
          key={index}
          data-cv-row={row.some((block) => block.block === "plan") ? "plan" : ""}
        >
          {row.map((block) => renderBlock(block))}
        </div>
      ))}
    </div>
  );
}
