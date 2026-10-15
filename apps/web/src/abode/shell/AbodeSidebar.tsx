import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useParams, useRouter } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon, FolderPlusIcon, SquarePenIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { SidebarProviderUpdatePill } from "~/components/sidebar/SidebarProviderUpdatePill";
import { SidebarThreadUndoNotice } from "~/components/sidebar/SidebarThreadUndoNotice";
import { SidebarUpdateArchitectureWarning } from "~/components/sidebar/SidebarUpdatePill";
import { SidebarUtilityMenu } from "~/components/sidebar/SidebarChrome";
import {
  resolveAdjacentThreadId,
  shouldCreateNewThreadInCurrentProject,
} from "~/components/Sidebar.logic";
import { Button } from "~/components/ui/button";
import { SidebarContent, SidebarFooter, SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { openCommandPalette, isCommandPaletteOpen } from "~/commandPaletteBus";
import { composerDraftHasUserContent, DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { isElectron } from "~/env";
import { useClientSettings } from "~/hooks/useSettings";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import {
  resolveShortcutCommand,
  shortcutLabelForCommand,
  threadJumpIndexFromCommand,
  threadTraversalDirectionFromCommand,
} from "~/keybindings";
import { isEditableFocused } from "~/lib/editableFocus";
import { isPreviewFocused } from "~/lib/previewFocus";
import { startNewThreadFromContext } from "~/lib/chatThreadActions";
import { isTerminalFocused } from "~/lib/terminalFocus";
import { isModelPickerOpen } from "~/modelPickerVisibility";
import { primaryServerKeybindingsAtom } from "~/state/server";
import {
  buildThreadRouteParams,
  resolveActiveThreadRouteRef,
  resolveThreadRouteTarget,
} from "~/threadRoutes";
import { resolveProjectExpanded, useUiStateStore } from "~/uiStateStore";
import { CustomizationsSlot } from "./CustomizationsSlot";
import {
  AbodeActiveRouteContext,
  AbodeSidebarContext,
  type AbodeActiveRoute,
  type AbodeSidebarContextValue,
} from "./sidebarContext";
import { useAbodeThreadActions } from "./useAbodeThreadActions";
import { useWorkspaceGroups } from "./useWorkspaceGroups";
import { splitHiddenWorkspaces } from "./workspaceHidden";
import { useHiddenWorkspacesStore } from "./workspaceHiddenStore";
import { deriveWorkspaceThreadState } from "./threadState";
import { jumpOrderKeys, resolveWorkspacePill, workspacePillView } from "./workspaceList";
import { draftIdsByWorkspace, threadShellKey } from "./workspaceModel";
import { expansionPreferenceKeys, WorkspaceSection } from "./WorkspaceSection";
import "./shell.css";

/**
 * The one abode sidebar: workspaces with their sessions underneath. It replaces
 * upstream's two thread sidebars (hooked in `AppSidebarLayout`), and reads the
 * same stores, grouping and commands they do.
 */
const NO_DRAFTS: ReadonlyArray<string> = [];

export function AbodeSidebar() {
  const groups = useWorkspaceGroups();
  const actions = useAbodeThreadActions();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const newThreadContext = useHandleNewThread();
  const projectExpandedById = useUiStateStore((state) => state.projectExpandedById);

  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const routeDraftThread = useComposerDraftStore((store) =>
    routeTarget?.kind === "draft" ? store.getDraftSession(routeTarget.draftId) : null,
  );
  const routeThreadRef = useMemo(
    () => resolveActiveThreadRouteRef(routeTarget, routeDraftThread),
    [routeDraftThread, routeTarget],
  );
  const activeThreadKey = routeThreadRef ? scopedThreadKey(routeThreadRef) : null;
  const activeDraftId = routeTarget?.kind === "draft" ? routeTarget.draftId : null;

  const navigateToThread = useCallback(
    (threadRef: ScopedThreadRef) => {
      if (isMobile) setOpenMobile(false);
      void router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
      });
    },
    [isMobile, router, setOpenMobile],
  );
  const navigateToDraft = useCallback(
    (draftId: string) => {
      if (isMobile) setOpenMobile(false);
      void router.navigate({ to: "/draft/$draftId", params: { draftId: DraftId.make(draftId) } });
    },
    [isMobile, router, setOpenMobile],
  );

  const [showAllByWorkspace, setShowAllByWorkspace] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const handleShowAll = useCallback((workspaceKey: string, showAll: boolean) => {
    setShowAllByWorkspace((current) => {
      if (current.has(workspaceKey) === showAll) return current;
      const next = new Set(current);
      if (showAll) next.add(workspaceKey);
      else next.delete(workspaceKey);
      return next;
    });
  }, []);
  const previewCount = useClientSettings((settings) => settings.sidebarThreadPreviewCount);

  const threadByKey = useMemo(
    () => new Map(groups.flatMap((group) => group.threads).map((t) => [threadShellKey(t), t])),
    [groups],
  );

  // Draft ids per workspace, computed once. The selector returns a string so typing
  // in a draft that is not listed does not re-render the sidebar.
  const draftIdsJson = useComposerDraftStore((store) =>
    JSON.stringify(
      draftIdsByWorkspace({
        groups: groups.map((group) => group.project),
        sessions: store.draftThreadsByThreadKey,
        composers: store.draftsByThreadKey,
        routeDraftId: activeDraftId,
        hasContent: composerDraftHasUserContent,
      }),
    ),
  );
  const draftIds = useMemo(
    () => JSON.parse(draftIdsJson) as Record<string, string[]>,
    [draftIdsJson],
  );

  // Hidden workspaces sit under a "N hidden" row; the one you are in always stays listed.
  const hiddenKeys = useHiddenWorkspacesStore((state) => state.hiddenKeys);
  const [revealHidden, setRevealHidden] = useState(false);
  const { shown: shownGroups, hidden: hiddenGroups } = useMemo(
    () =>
      splitHiddenWorkspaces(groups, {
        hiddenKeys,
        keyOf: (group) => group.project.projectKey,
        isActive: (group) =>
          group.threads.some((thread) => threadShellKey(thread) === activeThreadKey) ||
          (activeDraftId !== null &&
            (draftIds[group.project.projectKey] ?? NO_DRAFTS).includes(activeDraftId)),
      }),
    [activeDraftId, activeThreadKey, draftIds, groups, hiddenKeys],
  );
  // Forget the expanded state once nothing is hidden, so the next hide starts collapsed.
  if (revealHidden && hiddenGroups.length === 0) setRevealHidden(false);
  // A hidden workspace's "needs you" or running state still shows, on the "N hidden" row.
  const hiddenThreads = useMemo(
    () => hiddenGroups.flatMap((group) => group.threads),
    [hiddenGroups],
  );
  const hiddenVisitedAts = useUiStateStore(
    useShallow((state) =>
      hiddenThreads.map((thread) => state.threadLastVisitedAtById[threadShellKey(thread)] ?? null),
    ),
  );
  const hiddenPill = useMemo(() => {
    const pill = resolveWorkspacePill(
      hiddenThreads.map((thread, index) =>
        deriveWorkspaceThreadState(thread, hiddenVisitedAts[index] ?? undefined),
      ),
    );
    return pill && pill.kind !== "done" ? { pill, view: workspacePillView(pill) } : null;
  }, [hiddenThreads, hiddenVisitedAts]);
  const listedGroups = useMemo(
    () => (revealHidden ? [...shownGroups, ...hiddenGroups] : shownGroups),
    [hiddenGroups, revealHidden, shownGroups],
  );

  // Ctrl+1..9 and previous/next walk exactly the rows the workspaces render.
  const orderedThreadKeys = useMemo(
    () =>
      jumpOrderKeys(
        listedGroups.map((group) => ({
          threads: group.threads,
          expanded: resolveProjectExpanded(projectExpandedById, expansionPreferenceKeys(group)),
          showAll: showAllByWorkspace.has(group.project.projectKey),
        })),
        { latest: previewCount, activeKey: activeThreadKey, keyOf: threadShellKey },
      ),
    [activeThreadKey, listedGroups, previewCount, projectExpandedById, showAllByWorkspace],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen() || isModelPickerOpen()) {
        return;
      }
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          previewFocus: isPreviewFocused(),
          editableFocus: isEditableFocused(event.target),
          modelPickerOpen: isModelPickerOpen(),
        },
      });
      const goTo = (threadKey: string | null) => {
        const target = threadKey === null ? undefined : threadByKey.get(threadKey);
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        navigateToThread(scopeThreadRef(target.environmentId, target.id));
      };
      const direction = threadTraversalDirectionFromCommand(command);
      if (direction !== null) {
        goTo(
          resolveAdjacentThreadId({
            threadIds: orderedThreadKeys,
            currentThreadId: activeThreadKey,
            direction,
          }),
        );
        return;
      }
      const jumpIndex = threadJumpIndexFromCommand(command ?? "");
      if (jumpIndex !== null) goTo(orderedThreadKeys[jumpIndex] ?? null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeThreadKey, keybindings, navigateToThread, orderedThreadKeys, threadByKey]);

  // Like the other sidebars: one workspace (or Shift) starts right here, several ask first.
  const handleNewSession = useCallback(
    (event: React.MouseEvent) => {
      if (shouldCreateNewThreadInCurrentProject(event.shiftKey, groups.length)) {
        if (isMobile) setOpenMobile(false);
        void startNewThreadFromContext({
          activeDraftThread: newThreadContext.activeDraftThread,
          activeThread: newThreadContext.activeThread ?? undefined,
          defaultProjectRef: newThreadContext.defaultProjectRef,
          handleNewThread: newThreadContext.handleNewThread,
        });
        return;
      }
      if (isMobile) setOpenMobile(false);
      openCommandPalette({ open: "new-thread-in" });
    },
    [groups.length, isMobile, newThreadContext, setOpenMobile],
  );
  const newSessionShortcut =
    shortcutLabelForCommand(keybindings, "chat.new") ??
    shortcutLabelForCommand(keybindings, "chat.newLocal");

  const context = useMemo<AbodeSidebarContextValue>(
    () => ({ actions, navigateToThread, navigateToDraft }),
    [actions, navigateToDraft, navigateToThread],
  );
  const activeRoute = useMemo<AbodeActiveRoute>(
    () => ({ threadKey: activeThreadKey, draftId: activeDraftId }),
    [activeDraftId, activeThreadKey],
  );

  return (
    <AbodeSidebarContext value={context}>
      <AbodeActiveRouteContext value={activeRoute}>
        <div data-abode="title-strip" className={isElectron ? "drag-region" : undefined}>
          <SidebarTrigger className="md:hidden" />
          <span data-abode="strip" className="min-w-0 flex-1 truncate p-0">
            Agents
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label="New session"
                  data-testid="sidebar-new-session"
                  onClick={handleNewSession}
                />
              }
            >
              <SquarePenIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="bottom">
              New session{newSessionShortcut ? ` (${newSessionShortcut})` : ""}
            </TooltipPopup>
          </Tooltip>
        </div>
        <div data-abode="strip">
          <span className="min-w-0 flex-1 truncate">Workspaces</span>
          <span className="font-normal tabular-nums">{shownGroups.length}</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label="Add workspace"
                  data-testid="sidebar-add-project-trigger"
                  onClick={() => openCommandPalette({ open: "add-project" })}
                />
              }
            >
              <FolderPlusIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="right">Add workspace</TooltipPopup>
          </Tooltip>
        </div>
        <SidebarContent>
          {shownGroups.map((group) => (
            <WorkspaceSection
              key={group.project.projectKey}
              group={group}
              showAll={showAllByWorkspace.has(group.project.projectKey)}
              onShowAll={handleShowAll}
              draftIds={draftIds[group.project.projectKey] ?? NO_DRAFTS}
            />
          ))}
          {hiddenGroups.length > 0 ? (
            <button
              type="button"
              aria-expanded={revealHidden}
              data-testid="sidebar-hidden-workspaces"
              data-abode="row hidden-toggle"
              onClick={() => setRevealHidden((current) => !current)}
            >
              {revealHidden ? (
                <ChevronDownIcon aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <ChevronRightIcon aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-left">
                {hiddenGroups.length} hidden
              </span>
              {hiddenPill?.view.kind === "failed" ? (
                <span data-abode="meta" className="font-medium text-error-foreground">
                  {hiddenPill.view.text}
                </span>
              ) : hiddenPill?.view ? (
                <span
                  role="img"
                  aria-label={hiddenPill.pill.detail}
                  data-tone={hiddenPill.view.tone}
                  data-abode="workspace-pill"
                >
                  {hiddenPill.view.text}
                </span>
              ) : null}
            </button>
          ) : null}
          {revealHidden
            ? hiddenGroups.map((group) => (
                <WorkspaceSection
                  key={group.project.projectKey}
                  group={group}
                  hidden
                  showAll={showAllByWorkspace.has(group.project.projectKey)}
                  onShowAll={handleShowAll}
                  draftIds={draftIds[group.project.projectKey] ?? NO_DRAFTS}
                />
              ))
            : null}
          {groups.length === 0 ? (
            <div className="px-3 pt-4 text-center text-xs text-sidebar-muted-foreground">
              No workspaces yet
            </div>
          ) : null}
        </SidebarContent>
        <CustomizationsSlot />
        <SidebarFooter>
          <SidebarThreadUndoNotice />
          <SidebarProviderUpdatePill />
          <SidebarUpdateArchitectureWarning />
          {/* The activity bar carries Settings, Pull requests and Usage on desktop; phones have no bar. */}
          <div className="md:hidden">
            <SidebarUtilityMenu />
          </div>
        </SidebarFooter>
      </AbodeActiveRouteContext>
    </AbodeSidebarContext>
  );
}
