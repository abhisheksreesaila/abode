import { useAtomValue } from "@effect/atom-react";

import { deriveProviderInstanceEntries } from "~/providerInstances";
import type { SidebarProjectGroupMember } from "~/sidebarProjectGrouping";
import { primaryServerProvidersAtom } from "~/state/server";
import { useUiStateStore } from "~/uiStateStore";

import { deriveWorkspaceThreadState } from "../shell/threadState";
import { useWorkspaceGroups } from "../shell/useWorkspaceGroups";
import { threadShellKey } from "../shell/workspaceModel";
import { shownWorkspaces } from "../shell/workspaceRemoved";
import { useRemovedWorkspacesStore } from "../shell/workspaceRemovedStore";
import { groupRailItems, workspaceGroup, type RailGroup } from "./railGroups";
import { sessionPills, type SessionPills } from "./sessionPills";

export interface CanvasWorkspace {
  readonly key: string;
  readonly name: string;
  readonly group: RailGroup;
  readonly sessions: SessionPills;
  /** Where "+" starts a session: the first member project, like the sidebar's "+". */
  readonly newSessionTarget: SidebarProjectGroupMember | undefined;
}

/** The real projects for the rail, grouped from live thread state the way the sidebar reads it. */
export function useCanvasWorkspaces(): CanvasWorkspace[] {
  const groups = useWorkspaceGroups();
  const visits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const removedKeys = useRemovedWorkspacesStore((state) => state.removedKeys);
  const providers = useAtomValue(primaryServerProvidersAtom);
  const driverByInstance = new Map(
    deriveProviderInstanceEntries(providers).map((entry) => [entry.instanceId, entry.driverKind]),
  );
  return groupRailItems(
    shownWorkspaces(
      groups.filter((group) => !group.isScratch),
      { removedKeys, keyOf: (group) => group.project.projectKey },
    ).map((group) => ({
      key: group.project.projectKey,
      name: group.name,
      group: workspaceGroup(
        group.threads.map((thread) =>
          deriveWorkspaceThreadState(thread, visits[threadShellKey(thread)]),
        ),
      ),
      sessions: sessionPills(group.threads, {
        subagentsByParentKey: group.runningSubagentsByParentKey,
        visitedAt: (thread) => visits[threadShellKey(thread)],
        driverOf: (thread) => driverByInstance.get(thread.modelSelection.instanceId),
      }),
      newSessionTarget: group.project.memberProjects[0],
    })),
  );
}
