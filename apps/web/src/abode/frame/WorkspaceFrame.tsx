import { useParams } from "@tanstack/react-router";
import { ChevronDownIcon, ListIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { useComposerDraftStore } from "~/composerDraftStore";
import { observeResize } from "~/lib/observeResize";
import { deriveWorkspaceMutationId } from "~/components/ChatView.logic";
import {
  useQuietThreadVisibleTurnItems,
  useThreadProjection,
  useThreadShell,
} from "~/state/entities";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "~/threadRoutes";
import { useUiStateStore } from "~/uiStateStore";

import { openPendingQuestion, watchPendingQuestion } from "../calm/openPendingQuestion";
import { BackToCanvas } from "../canvas/BackToCanvas";
import { useCanvasStore } from "../canvas/canvasStore";
import { fillComposer } from "../composerFill";
import { planBlock } from "../canvas/planBlock";
import { usePlanFile } from "../canvas/usePlanFile";
import { useOpenSession } from "../canvas/useOpenSession";
import { useWorkspaceGroups, type WorkspaceGroup } from "../shell/useWorkspaceGroups";
import { threadShellKey } from "../shell/workspaceModel";
import { agentCards, runningCount, type AgentCard } from "./agentCards";
import { FRAME_TABS, tabFor, useFrameStore, type FrameTab } from "./frameStore";
import { workspaceOf } from "./frameWorkspace";
import { KitMeter, KitPane, KitStrip, KitTabs, type KitTab } from "./KitFrame";
import { useHostHomePath } from "./kitData";
import { isKitProject } from "./kitMode";
import { MilestonesPane } from "./MilestonesPane";
import "./frame.css";

const TAB_LABEL: Record<FrameTab, string> = {
  jam: "Jam",
  milestones: "Milestones",
  design: "Design",
};
const PLAN_PROMPT =
  "There is no docs/plan.md with milestones yet. Please read the project and write one: a Goal: line, then milestones (## Milestone: name) with tickets (### X-001: title, then - **Status:** todo). Don't start building.";
const TICK_MS = 30_000;
const ANSWER_TTL_MS = 5_000;
const NO_TYPES: ReadonlyMap<string, string> = new Map();

/**
 * The frame above the chat (A-057): one row with the way back, the workspace's threads, the
 * Jam, Milestones and Design tabs and the running count, then the agents working in it. Mounted from CalmTable, so only chat routes
 * (a thread or a new-thread draft) see it, and only with One window on.
 */
export function WorkspaceFrame() {
  const enabled = useCanvasStore((state) => state.enabled);
  return enabled ? <Frame /> : null;
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
  return <LoadedFrame group={group} threadRef={threadRef} />;
}

function LoadedFrame(props: {
  readonly group: WorkspaceGroup;
  readonly threadRef: ReturnType<typeof resolveActiveThreadRouteRef>;
}) {
  const { group, threadRef } = props;
  const workspaceKey = group.project.projectKey;
  const currentKey = threadRef === null ? null : `${threadRef.environmentId}:${threadRef.threadId}`;
  const tab = useFrameStore((state) => tabFor(state.tabs, workspaceKey));
  const answerRequest = useFrameStore((state) => state.answerRequest);
  const kitUpdatesRequested = useFrameStore((state) => state.kitUpdatesRequested);
  const visits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const open = useOpenSession();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pickedKitTab, setPickedKitTab] = useState<KitTab>("skills");
  // Bumped when Milestones opens and when the window regains focus, so hand edits show too.
  const [planTick, setPlanTick] = useState(0);

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
  const anyRunning = running > 0 || tab === "milestones";
  const pendingKeys = new Set(
    [...group.threads, ...[...group.runningSubagentsByParentKey.values()].flat()]
      .filter((thread) => thread.hasPendingApprovals || thread.hasPendingUserInput)
      .map(threadShellKey),
  );
  const currentHasQuestion = currentKey !== null && pendingKeys.has(currentKey);

  // Elapsed times refresh twice a minute while an agent runs or Milestones shows; nothing animates.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- timers that refresh the elapsed-time labels
  useEffect(() => {
    if (!anyRunning) return;
    const first = setTimeout(() => setNowMs(Date.now()), 1000);
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [anyRunning]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- window focus is an external event that should re-read the plan file
  useEffect(() => {
    const bump = () => setPlanTick((tick) => tick + 1);
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
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

  // A needs-you card asks for a thread's question to open. It waits for the composer to render
  // it (no polling), only when the thread has one, and the request expires.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- watches upstream's composer DOM for the question panel and clears the store request
  useEffect(() => {
    if (answerRequest === null) return;
    const clear = () => useFrameStore.getState().setAnswerRequest(null);
    const left = ANSWER_TTL_MS - (Date.now() - answerRequest.at);
    if (left <= 0 || (answerRequest.key === currentKey && !currentHasQuestion)) {
      clear();
      return;
    }
    const expire = setTimeout(clear, left);
    const stop =
      answerRequest.key === currentKey ? watchPendingQuestion(rootRef.current, clear) : undefined;
    return () => {
      clearTimeout(expire);
      stop?.();
    };
  }, [answerRequest, currentKey, currentHasQuestion]);

  const root = group.project.memberProjects[0];
  // The plan refetches when an agent finishes a command or file edit in this thread (the same
  // marker the chat's file previews use) or any thread in the workspace finishes a run.
  const editMarker = deriveWorkspaceMutationId(useQuietThreadVisibleTurnItems(threadRef), null);
  const turnSignal = `${planTick}|${editMarker ?? ""}|${group.threads.map((thread) => thread.latestRun?.completedAt ?? "").join("|")}`;
  const plan = usePlanFile(root?.environmentId, root?.workspaceRoot, turnSignal);
  const planText = plan.file?.contents;
  // Stamps when the plan's text changes, for Milestones' "updated Xm ago".
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- records the arrival time of an edit (impure) in the frame store
  useEffect(() => {
    if (planText !== undefined) useFrameStore.getState().notePlan(workspaceKey, planText);
  }, [workspaceKey, planText]);
  const block = plan.pending ? null : planBlock(plan);
  const count =
    block?.kind === "ready"
      ? `${block.rows.reduce((sum, row) => sum + row.done, 0)}/${block.rows.reduce((sum, row) => sum + row.total, 0)}`
      : null;

  // The Kit thread (a project rooted at the home folder) swaps Jam/Milestones/Design for the Kit tabs.
  const hostHome = useHostHomePath(root?.environmentId);
  const kitScope =
    root && isKitProject(root.workspaceRoot, hostHome)
      ? {
          environmentId: root.environmentId,
          cwd: root.workspaceRoot,
          projectName: root.title,
          threadRef,
          borrowed: false,
        }
      : null;
  // A feed line outside the frame asks for Updates; the next tab the person picks clears the ask.
  const kitTab: KitTab = kitScope && kitUpdatesRequested ? "updates" : pickedKitTab;
  const setKitTab = (next: KitTab) => {
    useFrameStore.getState().setKitUpdatesRequested(false);
    setPickedKitTab(next);
  };
  // Marks the conversation area while a pane covers it, so frame.css can dock a draft's hero composer.
  const paneOpen = kitScope ? kitTab !== "jam" : tab !== "jam";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- sets a data attribute on the conversation area, which upstream renders
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    if (!area || !paneOpen) return;
    area.setAttribute("data-abode-pane-open", "");
    return () => area.removeAttribute("data-abode-pane-open");
  }, [paneOpen]);

  const showJam = () => {
    useFrameStore.getState().setTab(workspaceKey, "jam");
    setKitTab("jam");
  };
  const pickCard = (card: AgentCard) => {
    showJam();
    if (card.key === currentKey) {
      if (card.status === "needs-you") openPendingQuestion(rootRef.current);
      return;
    }
    if (card.status === "needs-you") useFrameStore.getState().requestAnswer(card.key);
    open(card);
  };

  return (
    <>
      <div ref={rootRef} data-abode-frame="" data-testid="workspace-frame">
        <div data-abode-frame-head="">
          <div data-abode-frame-left="">
            <BackToCanvas />
            <Menu>
              <MenuTrigger
                data-abode-frame-picker=""
                data-testid="frame-threads"
                aria-label={`Threads, ${group.threads.length}`}
              >
                <ListIcon aria-hidden className="size-4 shrink-0 min-[641px]:hidden" />
                <span data-abode-long="">Threads</span>
                <small>{group.threads.length}</small>
                <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 max-[640px]:hidden" />
              </MenuTrigger>
              <MenuPopup align="start">
                {group.threads.length === 0 ? (
                  <MenuItem disabled>No threads yet</MenuItem>
                ) : (
                  group.threads.map((thread) => (
                    <MenuItem
                      key={threadShellKey(thread)}
                      onClick={() => {
                        showJam();
                        open({ environmentId: thread.environmentId, threadId: thread.id });
                      }}
                    >
                      {thread.title}
                    </MenuItem>
                  ))
                )}
              </MenuPopup>
            </Menu>
          </div>
          {kitScope ? (
            <KitTabs scope={kitScope} tab={kitTab} onTab={setKitTab} />
          ) : (
            <div data-abode-tabs="" role="tablist" aria-label="Workspace views">
              {FRAME_TABS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  data-selected={tab === value ? "" : undefined}
                  data-testid={`frame-tab-${value}`}
                  onClick={() => {
                    if (value === "milestones" && tab !== value) setPlanTick((tick) => tick + 1);
                    useFrameStore.getState().setTab(workspaceKey, value);
                  }}
                >
                  {TAB_LABEL[value]}
                  {value === "milestones" && count !== null ? <small>{count}</small> : null}
                </button>
              ))}
            </div>
          )}
          {kitScope ? (
            <KitMeter scope={kitScope} where="head" />
          ) : running > 0 ? (
            <span data-abode-frame-pill="" data-testid="frame-running">
              <i aria-hidden />
              {running} {running === 1 ? "agent" : "agents"} running
            </span>
          ) : null}
        </div>
        {kitScope ? (
          <KitStrip
            scope={kitScope}
            agent={cards.find((card) => card.key === currentKey) ?? null}
            nowMs={nowMs}
            onTab={setKitTab}
          />
        ) : cards.length > 0 ? (
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
      </div>
      {kitScope ? (
        kitTab === "jam" ? null : (
          <KitPane scope={kitScope} tab={kitTab} nowMs={nowMs} onTab={setKitTab} />
        )
      ) : tab === "jam" ? null : (
        <section data-abode-frame-pane="" aria-label={TAB_LABEL[tab]} data-testid="frame-pane">
          {tab === "milestones" ? (
            <MilestonesPane
              block={block ?? { kind: "loading" }}
              workspaceKey={workspaceKey}
              nowMs={nowMs}
              onAskToPlan={
                threadRef === null ? undefined : () => fillComposer(threadRef, PLAN_PROMPT)
              }
            />
          ) : (
            <p>Design: coming in A-059</p>
          )}
        </section>
      )}
    </>
  );
}
