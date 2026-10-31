import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { FolderPlusIcon, SearchIcon, SettingsIcon, SquarePenIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
import { shownWorkspaces, workspaceToRestore, type OpenWorkspace } from "./workspaceRemoved";
import { useRemovedWorkspacesStore } from "./workspaceRemovedStore";
import { WORKSPACE_PREVIEW_COUNT, jumpOrderKeys } from "./workspaceList";
import { draftIdsByWorkspace, threadShellKey } from "./workspaceModel";
import { expansionPreferenceKeys, WorkspaceSection } from "./WorkspaceSection";
import "./shell.css";

/**
 * The one abode sidebar: workspaces with their sessions underneath. It replaces
 * upstream's two thread sidebars (hooked in `AppSidebarLayout`), and reads the
 * same stores, grouping and commands they do.
 */
const NO_DRAFTS: ReadonlyArray<string> = [];
/** Module scope on purpose: the sidebar unmounts on Settings, and returning must still count as a move. A reload resets it. */
let previousOpenWorkspace: OpenWorkspace | null = null;

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
  const routeThreadRef = resolveActiveThreadRouteRef(routeTarget, routeDraftThread);
  const activeThreadKey = routeThreadRef ? scopedThreadKey(routeThreadRef) : null;
  const activeDraftId = routeTarget?.kind === "draft" ? routeTarget.draftId : null;

  const navigateToThread = (threadRef: ScopedThreadRef) => {
    if (isMobile) setOpenMobile(false);
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
    });
  };
  const navigateToDraft = (draftId: string) => {
    if (isMobile) setOpenMobile(false);
    void router.navigate({ to: "/draft/$draftId", params: { draftId: DraftId.make(draftId) } });
  };

  const [showAllByWorkspace, setShowAllByWorkspace] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const handleShowAll = (workspaceKey: string, showAll: boolean) => {
    setShowAllByWorkspace((current) => {
      if (current.has(workspaceKey) === showAll) return current;
      const next = new Set(current);
      if (showAll) next.add(workspaceKey);
      else next.delete(workspaceKey);
      return next;
    });
  };

  const threadByKey = new Map(
    groups.flatMap((group) => group.threads).map((t) => [threadShellKey(t), t]),
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
  const draftIds = JSON.parse(draftIdsJson) as Record<string, string[]>;

  // Removed workspaces are left out of the list. One returns when it becomes the open one
  // (picked in the new-session chip, or added again) and stays back after that.
  const removedKeys = useRemovedWorkspacesStore((state) => state.removedKeys);
  const listedGroups = shownWorkspaces(groups, {
    removedKeys,
    keyOf: (group) => group.project.projectKey,
  });
  const openRouteId = activeThreadKey ?? activeDraftId;
  const openWorkspaceKey =
    groups.find(
      (group) =>
        group.threads.some((thread) => threadShellKey(thread) === activeThreadKey) ||
        (activeDraftId !== null &&
          (draftIds[group.project.projectKey] ?? NO_DRAFTS).includes(activeDraftId)),
    )?.project.projectKey ?? null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- un-removes a workspace in the removed-workspaces store when navigation opens one of its threads
  useEffect(() => {
    const current =
      openRouteId !== null && openWorkspaceKey !== null
        ? { routeId: openRouteId, workspaceKey: openWorkspaceKey }
        : null;
    const { removedKeys: removed, setRemoved } = useRemovedWorkspacesStore.getState();
    const key = workspaceToRestore({
      previous: previousOpenWorkspace,
      current,
      removedKeys: removed,
    });
    if (key !== null) setRemoved(key, false);
    if (current !== null) previousOpenWorkspace = current;
  }, [openRouteId, openWorkspaceKey]);

  // Ctrl+1..9 and previous/next walk exactly the rows the workspaces render.
  const orderedThreadKeys = jumpOrderKeys(
    listedGroups.map((group) => ({
      threads: group.threads,
      expanded: resolveProjectExpanded(projectExpandedById, expansionPreferenceKeys(group)),
      showAll: showAllByWorkspace.has(group.project.projectKey),
    })),
    { latest: WORKSPACE_PREVIEW_COUNT, activeKey: activeThreadKey, keyOf: threadShellKey },
  );

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- window keydown listener for thread jump and previous/next shortcuts
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
  const handleNewSession = (event: React.MouseEvent) => {
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
  };
  const searchShortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const newSessionShortcut =
    shortcutLabelForCommand(keybindings, "chat.new") ??
    shortcutLabelForCommand(keybindings, "chat.newLocal");

  const context: AbodeSidebarContextValue = { actions, navigateToThread, navigateToDraft };
  const activeRoute: AbodeActiveRoute = { threadKey: activeThreadKey, draftId: activeDraftId };

  return (
    <AbodeSidebarContext value={context}>
      <AbodeActiveRouteContext value={activeRoute}>
        <div data-abode="title-strip" className={isElectron ? "drag-region" : undefined}>
          <SidebarTrigger className="md:hidden" />
          <Link
            to="/"
            aria-label="abode home"
            data-testid="sidebar-home"
            className="min-w-0 truncate rounded-xs text-base font-bold tracking-tight text-primary outline-hidden ring-ring focus-visible:ring-1 focus-visible:ring-inset"
          >
            abode
          </Link>
          <span className="flex-1" />
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label="Search"
                  data-testid="sidebar-search"
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    openCommandPalette();
                  }}
                />
              }
            >
              <SearchIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="bottom">
              Search{searchShortcut ? ` (${searchShortcut})` : ""}
            </TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label="Settings"
                  className="max-md:hidden"
                  data-testid="sidebar-settings"
                  onClick={() => void router.navigate({ to: "/settings" })}
                />
              }
            >
              <SettingsIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="bottom">Settings</TooltipPopup>
          </Tooltip>
        </div>
        <div data-abode="strip">
          <span className="min-w-0 flex-1 truncate">Workspaces</span>
          <span className="font-normal tabular-nums">{listedGroups.length}</span>
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
          {listedGroups.map((group) => (
            <WorkspaceSection
              key={group.project.projectKey}
              group={group}
              showAll={showAllByWorkspace.has(group.project.projectKey)}
              onShowAll={handleShowAll}
              draftIds={draftIds[group.project.projectKey] ?? NO_DRAFTS}
            />
          ))}
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
          {/* Desktop has Settings in the header; phones keep the utility menu. */}
          <div className="md:hidden">
            <SidebarUtilityMenu />
          </div>
        </SidebarFooter>
      </AbodeActiveRouteContext>
    </AbodeSidebarContext>
  );
}
