import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { ContextMenuItem } from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import { useShallow } from "zustand/react/shallow";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useClientSettings } from "~/hooks/useSettings";
import { readLocalApi } from "~/localApi";
import {
  legacyProjectCwdPreferenceKey,
  resolveProjectExpanded,
  useUiStateStore,
} from "~/uiStateStore";
import type { SidebarProjectGroupMember } from "~/sidebarProjectGrouping";
import { useAbodeActiveRoute } from "./sidebarContext";
import { ThreadRow } from "./ThreadRow";
import { deriveWorkspaceThreadState } from "./threadState";
import type { WorkspaceGroup } from "./useWorkspaceGroups";
import { WorkspaceDrafts } from "./WorkspaceDrafts";
import { buildWorkspaceColorMenuItem } from "./workspaceColor";
import { useWorkspaceColorStyle } from "./workspaceColorHooks";
import { applyWorkspaceColorMenuChoice } from "./workspaceColorStore";
import {
  formatWorkspaceLocation,
  resolveWorkspacePill,
  threadListWindow,
  workspacePillView,
} from "./workspaceList";
import { threadShellKey } from "./workspaceModel";

function expansionPreferenceKeys(group: WorkspaceGroup): string[] {
  const { project } = group;
  return [
    project.projectKey,
    ...project.memberProjects.map((member) => member.physicalProjectKey),
    ...project.memberProjects.map((member) => legacyProjectCwdPreferenceKey(member.workspaceRoot)),
  ];
}

function memberLabel(member: SidebarProjectGroupMember): string {
  return member.environmentLabel
    ? `${member.environmentLabel} — ${member.workspaceRoot}`
    : member.workspaceRoot;
}

/**
 * One workspace: a one-line header (chevron, color dot, name, folder, count
 * pill) and its sessions underneath. Sessions come from upstream's thread
 * shells; the color is an abode setting kept in this browser.
 */
export const WorkspaceSection = memo(function WorkspaceSection(props: {
  readonly group: WorkspaceGroup;
}) {
  const { group } = props;
  const { project } = group;
  const { threadKey: activeThreadKey } = useAbodeActiveRoute();
  const router = useRouter();
  const handleNewThread = useNewThreadHandler();
  const previewCount = useClientSettings((settings) => settings.sidebarThreadPreviewCount);
  const color = useWorkspaceColorStyle(project.projectKey);
  const preferenceKeys = useMemo(() => expansionPreferenceKeys(group), [group]);
  const expanded = useUiStateStore((state) =>
    resolveProjectExpanded(state.projectExpandedById, preferenceKeys),
  );
  const setProjectExpanded = useUiStateStore((state) => state.setProjectExpanded);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const { copyToClipboard: copyPath } = useCopyToClipboard<{ path: string }>({
    onCopy: ({ path }) =>
      toastManager.add({ type: "success", title: "Path copied", description: path }),
  });

  const visitedAts = useUiStateStore(
    useShallow((state) =>
      group.threads.map((thread) => state.threadLastVisitedAtById[threadShellKey(thread)] ?? null),
    ),
  );
  const pill = useMemo(
    () =>
      resolveWorkspacePill(
        group.threads.map((thread, index) =>
          deriveWorkspaceThreadState(thread, visitedAts[index] ?? undefined),
        ),
      ),
    [group.threads, visitedAts],
  );
  const pillView = pill ? workspacePillView(pill) : null;

  const activeIsHere =
    activeThreadKey !== null &&
    group.threads.some((thread) => threadShellKey(thread) === activeThreadKey);
  // A collapsed workspace still shows the open session, so the sidebar always says where you are.
  const threadWindow = threadListWindow(group.threads, {
    expanded: showAllThreads,
    latest: previewCount,
    isActive: (thread) => threadShellKey(thread) === activeThreadKey,
  });
  const visibleThreads = expanded
    ? threadWindow.shown
    : group.threads.filter((thread) => threadShellKey(thread) === activeThreadKey);

  const firstMember = project.memberProjects[0];
  const location = formatWorkspaceLocation({
    workspaceRoot: group.isScratch ? "" : (firstMember?.workspaceRoot ?? project.workspaceRoot),
    remoteEnvironmentLabels: project.remoteEnvironmentLabels,
    isRemoteOnly: project.environmentPresence === "remote-only",
  });

  const toggle = useCallback(() => {
    setProjectExpanded(preferenceKeys, !expanded);
  }, [expanded, preferenceKeys, setProjectExpanded]);

  const createSession = useCallback(
    async (member: SidebarProjectGroupMember) => {
      // No options: branch, worktree and env mode come from the user's defaults.
      const result = await settlePromise(() =>
        handleNewThread(scopeProjectRef(member.environmentId, member.id)),
      );
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
    },
    [handleNewThread],
  );

  const handleNewSession = useCallback(
    async (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (project.memberProjects.length === 1) {
        void createSession(project.memberProjects[0]!);
        return;
      }
      const api = readLocalApi();
      if (!api) return;
      const clicked = await settlePromise(() =>
        api.contextMenu.show(
          project.memberProjects.map((member) => ({
            id: member.physicalProjectKey,
            label: memberLabel(member),
          })),
          { x: event.clientX, y: event.clientY },
        ),
      );
      if (clicked._tag === "Failure" || clicked.value === null) return;
      const member = project.memberProjects.find(
        (candidate) => candidate.physicalProjectKey === clicked.value,
      );
      if (member) void createSession(member);
    },
    [createSession, project.memberProjects],
  );

  const handleContextMenu = useCallback(
    async (event: MouseEvent) => {
      event.preventDefault();
      const api = readLocalApi();
      if (!api) return;
      const items: ContextMenuItem<string>[] = [
        { id: "new-session", label: "New session" },
        buildWorkspaceColorMenuItem(),
        ...(group.isScratch
          ? []
          : [{ id: "copy-path", label: "Copy path", separatorBefore: true }]),
        { id: "project-settings", label: "Project settings", icon: "settings" },
      ];
      const clicked = await settlePromise(() =>
        api.contextMenu.show(items, { x: event.clientX, y: event.clientY }),
      );
      if (clicked._tag === "Failure" || clicked.value === null) return;
      if (applyWorkspaceColorMenuChoice(project.projectKey, clicked.value)) return;
      if (clicked.value === "new-session" && firstMember) void createSession(firstMember);
      else if (clicked.value === "copy-path" && firstMember) {
        copyPath(firstMember.workspaceRoot, { path: firstMember.workspaceRoot });
      } else if (clicked.value === "project-settings") {
        void router.navigate({
          to: "/projects/$projectKey",
          params: { projectKey: project.projectKey },
        });
      }
    },
    [copyPath, createSession, firstMember, group.isScratch, project.projectKey, router],
  );

  const ChevronIcon = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <section
      aria-label={group.name}
      data-testid={`workspace-${project.projectKey}`}
      style={color ? ({ "--workspace-color": color.color } as React.CSSProperties) : undefined}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        data-testid="workspace-header"
        onClick={toggle}
        onContextMenu={handleContextMenu}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        data-abode="row workspace-header"
      >
        <ChevronIcon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
        <span aria-hidden data-abode="workspace-dot" />
        <span className="min-w-0 truncate font-medium">{group.name}</span>
        {location ? (
          <span data-abode="workspace-location" className="min-w-0 flex-1 truncate">
            {location}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {pillView?.kind === "failed" ? (
          <span data-abode="meta" className="font-medium text-error-foreground">
            {pillView.text}
          </span>
        ) : pillView ? (
          <span
            aria-label={pill?.detail}
            data-tone={pillView.tone}
            data-testid="workspace-pill"
            data-abode="workspace-pill"
          >
            {pillView.text}
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`New session in ${group.name}`}
                data-testid="workspace-new-session"
                data-abode="inline-action"
                onClick={handleNewSession}
              />
            }
          >
            <PlusIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="right">New session in {group.name}</TooltipPopup>
        </Tooltip>
      </div>
      {expanded || activeIsHere ? (
        <ul data-abode="guide">
          {expanded ? <WorkspaceDrafts memberProjectRefs={project.memberProjectRefs} /> : null}
          {visibleThreads.map((thread) => (
            <ThreadRow
              key={`${thread.environmentId}:${thread.id}`}
              thread={thread}
              workspaceKey={project.projectKey}
              workspaceRoot={firstMember?.workspaceRoot ?? null}
              isActive={threadShellKey(thread) === activeThreadKey}
              runningSubagents={
                group.runningSubagentsByParentKey.get(`${thread.environmentId}:${thread.id}`) ?? []
              }
            />
          ))}
          {expanded && threadWindow.showMore ? (
            <li className="list-none">
              <button
                type="button"
                data-abode="row thread meta"
                onClick={() => setShowAllThreads(true)}
              >
                {threadWindow.olderCount} older
              </button>
            </li>
          ) : null}
          {expanded && threadWindow.showLess ? (
            <li className="list-none">
              <button
                type="button"
                data-abode="row thread meta"
                onClick={() => setShowAllThreads(false)}
              >
                Show less
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
});
