import { useParams } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { useComposerDraftStore } from "~/composerDraftStore";
import { observeResize } from "~/lib/observeResize";
import { useThreadProjection, useThreadShell } from "~/state/entities";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "~/threadRoutes";
import { useUiStateStore } from "~/uiStateStore";

import { openPendingQuestion } from "../calm/openPendingQuestion";
import { BackToCanvas } from "../canvas/BackToCanvas";
import { useCanvasStore } from "../canvas/canvasStore";
import { planBlock } from "../canvas/planBlock";
import { usePlanFile } from "../canvas/usePlanFile";
import { useOpenSession } from "../canvas/useOpenSession";
import { useWorkspaceGroups, type WorkspaceGroup } from "../shell/useWorkspaceGroups";
import { threadShellKey } from "../shell/workspaceModel";
import { agentCards, runningCount, type AgentCard } from "./agentCards";
import { FRAME_TABS, tabFor, useFrameStore, type FrameTab } from "./frameStore";
import "./frame.css";

const TAB_LABEL: Record<FrameTab, string> = {
  jam: "Jam",
  milestones: "Milestones",
  design: "Design",
};
const PLACEHOLDER: Record<Exclude<FrameTab, "jam">, string> = {
  milestones: "Milestones: coming in A-058",
  design: "Design: coming in A-059",
};
const TICK_MS = 30_000;
const NO_TYPES: ReadonlyMap<string, string> = new Map();

/**
 * The frame above the chat (A-057): which workspace and thread this is, the agents working in
 * it, and the Jam, Milestones and Design tabs. Mounted from CalmTable, so only chat routes
 * (a thread or a new-thread draft) see it, and only with One window on.
 */
export function WorkspaceFrame() {
  const enabled = useCanvasStore((state) => state.enabled);
  return enabled ? <Frame /> : null;
}

function workspaceOf(
  groups: ReadonlyArray<WorkspaceGroup>,
  ref: { readonly environmentId: string; readonly projectId: string } | null,
): WorkspaceGroup | undefined {
  if (ref === null) return undefined;
  return groups.find((group) =>
    group.project.memberProjectRefs.some(
      (member) => member.environmentId === ref.environmentId && member.projectId === ref.projectId,
    ),
  );
}

function Frame() {
  const groups = useWorkspaceGroups();
  const target = useParams({ strict: false, select: (params) => resolveThreadRouteTarget(params) });
  const draft = useComposerDraftStore((store) =>
    target?.kind === "draft" ? store.getDraftSession(target.draftId) : null,
  );
  const threadRef = resolveActiveThreadRouteRef(target, draft);
  const shell = useThreadShell(threadRef);
  const group = workspaceOf(groups, shell ?? draft);
  // A thread that is not loaded yet, or a workspace not listed: keep the way back, nothing else.
  if (group === undefined) return <BackToCanvas />;
  return (
    <LoadedFrame group={group} threadRef={threadRef} threadTitle={shell?.title ?? "New session"} />
  );
}

function LoadedFrame(props: {
  readonly group: WorkspaceGroup;
  readonly threadRef: ReturnType<typeof resolveActiveThreadRouteRef>;
  readonly threadTitle: string;
}) {
  const { group, threadRef, threadTitle } = props;
  const workspaceKey = group.project.projectKey;
  const currentKey = threadRef === null ? null : `${threadRef.environmentId}:${threadRef.threadId}`;
  const tab = useFrameStore((state) => tabFor(state.tabs, workspaceKey));
  const answerKey = useFrameStore((state) => state.answerThreadKey);
  const visits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const open = useOpenSession();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // The current thread's projection is already loaded by the chat, so its subagent types
  // come free; other threads' subagents are just "subagent".
  const projection = useThreadProjection(threadRef)?.projection ?? null;
  const typeByChild = projection
    ? new Map(
        projection.subagents.flatMap((subagent) =>
          subagent.childThreadId !== null && subagent.agentType !== undefined
            ? [[subagent.childThreadId as string, subagent.agentType] as const]
            : [],
        ),
      )
    : NO_TYPES;
  const cards = agentCards({
    threads: group.threads,
    subagentsByParentKey: group.runningSubagentsByParentKey,
    visitedAt: (thread) => visits[threadShellKey(thread)],
    agentTypeOf: (thread) => typeByChild.get(thread.id),
    nowMs,
  });
  const running = runningCount(cards);

  // Elapsed times refresh twice a minute; nothing animates.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- interval that refreshes the elapsed-time labels
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // The pane and the calm table start below the frame, which is as tall as its content.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- publishes the frame's height as a CSS variable on the conversation area
  useEffect(() => {
    const root = rootRef.current;
    const area = root?.parentElement;
    if (!root || !area) return;
    const apply = () => area.style.setProperty("--abode-frame-h", `${root.offsetHeight}px`);
    apply();
    const stop = observeResize(root, apply);
    return () => {
      stop();
      area.style.removeProperty("--abode-frame-h");
    };
  }, []);

  // A needs-you card on another thread opens that chat; its question panel appears a moment
  // later, so keep trying briefly.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- retries opening upstream's question panel in the composer once the chat has rendered it
  useEffect(() => {
    if (answerKey === null || answerKey !== currentKey) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (openPendingQuestion(rootRef.current) || tries >= 15) {
        clearInterval(timer);
        useFrameStore.getState().setAnswerThreadKey(null);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [answerKey, currentKey]);

  const root = group.project.memberProjects[0];
  const turnSignal = group.threads.map((thread) => thread.latestRun?.completedAt ?? "").join("|");
  const plan = usePlanFile(root?.environmentId, root?.workspaceRoot, turnSignal);
  const block = plan.pending ? null : planBlock(plan);
  const count =
    block?.kind === "ready"
      ? `${block.rows.reduce((sum, row) => sum + row.done, 0)}/${block.rows.reduce((sum, row) => sum + row.total, 0)}`
      : null;

  const pickCard = (card: AgentCard) => {
    if (card.key === currentKey) {
      if (card.status === "needs-you") openPendingQuestion(rootRef.current);
      return;
    }
    if (card.status === "needs-you") useFrameStore.getState().setAnswerThreadKey(card.key);
    open(card);
  };

  return (
    <>
      <div ref={rootRef} data-abode-frame="" data-testid="workspace-frame">
        <div data-abode-frame-head="">
          <BackToCanvas />
          <div data-abode-frame-title="">
            <span data-abode-frame-workspace="">{group.name}</span>
            <span data-abode-frame-sep="" aria-hidden>
              /
            </span>
            <Menu>
              <MenuTrigger data-abode-frame-picker="" aria-label={`Thread: ${threadTitle}`}>
                <span data-abode-frame-thread="">{threadTitle}</span>
                <ChevronDownIcon aria-hidden className="size-3.5 shrink-0" />
              </MenuTrigger>
              <MenuPopup align="start">
                {group.threads.length === 0 ? (
                  <MenuItem disabled>No other threads</MenuItem>
                ) : (
                  group.threads.map((thread) => (
                    <MenuItem
                      key={threadShellKey(thread)}
                      onClick={() =>
                        open({ environmentId: thread.environmentId, threadId: thread.id })
                      }
                    >
                      {thread.title}
                    </MenuItem>
                  ))
                )}
              </MenuPopup>
            </Menu>
          </div>
          {running > 0 ? (
            <span data-abode-frame-pill="" data-testid="frame-running">
              <i aria-hidden />
              <span data-abode-long="">
                {running} {running === 1 ? "agent" : "agents"} running
              </span>
              <span data-abode-short="">{running} running</span>
            </span>
          ) : null}
        </div>
        {cards.length > 0 ? (
          <div data-abode-strip="" aria-label="Agents">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                data-abode-card=""
                data-status={card.status}
                data-testid="agent-card"
                onClick={() => pickCard(card)}
              >
                <span data-abode-card-top="">
                  <b>{card.name}</b>
                  <span data-abode-card-meta="">{card.meta}</span>
                  <span data-abode-card-status="">{card.statusLabel}</span>
                </span>
                <span data-abode-card-doing="">{card.doing}</span>
                <span data-abode-card-bar="" aria-hidden>
                  <i style={{ width: `${card.progress ?? 0}%` }} />
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <div data-abode-tabs="" role="tablist" aria-label="Workspace views">
          {FRAME_TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              data-selected={tab === value ? "" : undefined}
              data-testid={`frame-tab-${value}`}
              onClick={() => useFrameStore.getState().setTab(workspaceKey, value)}
            >
              {TAB_LABEL[value]}
              {value === "milestones" && count !== null ? <small>{count}</small> : null}
            </button>
          ))}
        </div>
      </div>
      {tab === "jam" ? null : (
        <section data-abode-frame-pane="" aria-label={TAB_LABEL[tab]} data-testid="frame-pane">
          <p>{PLACEHOLDER[tab]}</p>
        </section>
      )}
    </>
  );
}
