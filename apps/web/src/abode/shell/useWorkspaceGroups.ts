import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { useMemo } from "react";

import {
  orderItemsByPreferredIds,
  sortSidebarV2ProjectGroups,
} from "../../components/Sidebar.logic";
import { useClientSettings } from "../../hooks/useSettings";
import { getProjectOrderKey, selectProjectGroupingSettings } from "../../logicalProject";
import {
  buildSidebarProjectSnapshots,
  type SidebarProjectSnapshot,
} from "../../sidebarProjectGrouping";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { useProjects, useServerConfigs, useThreadShells } from "../../state/entities";
import { sortThreads } from "../../lib/threadSort";
import type { SidebarThreadSummary } from "../../types";
import { legacyProjectCwdPreferenceKey, useUiStateStore } from "../../uiStateStore";
import { nestRunningSubagents } from "./subagentNesting";
import { groupThreadsByWorkspace, workspaceDisplayName } from "./workspaceModel";

export interface WorkspaceGroup {
  readonly project: SidebarProjectSnapshot;
  readonly name: string;
  /** The environment's scratch project: threads started without a folder. */
  readonly isScratch: boolean;
  /** Non-archived, non-subagent threads, in upstream's own thread order. */
  readonly threads: ReadonlyArray<SidebarThreadSummary>;
  readonly runningSubagentsByParentKey: ReadonlyMap<string, ReadonlyArray<SidebarThreadSummary>>;
}

/**
 * The workspace tree, built from the same stores, grouping rules and sort
 * orders as upstream's sidebars so the two always agree on what a workspace is.
 */
export function useWorkspaceGroups(): ReadonlyArray<WorkspaceGroup> {
  const projects = useProjects();
  const threads = useThreadShells();
  const serverConfigs = useServerConfigs();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectOrder = useUiStateStore((store) => store.projectOrder);
  const projectSortOrder = useClientSettings((settings) => settings.sidebarProjectSortOrder);
  const threadSortOrder = useClientSettings((settings) => settings.sidebarThreadSortOrder);
  const groupingSettings = useClientSettings(selectProjectGroupingSettings);

  return useMemo(() => {
    const environmentLabelById = new Map(
      environments.map((environment) => [environment.environmentId, environment.label] as const),
    );
    const orderedProjects =
      projectSortOrder === "manual"
        ? orderItemsByPreferredIds({
            items: projects,
            preferredIds: projectOrder,
            getId: getProjectOrderKey,
            getPreferenceIds: (project) => [
              getProjectOrderKey(project),
              legacyProjectCwdPreferenceKey(project.workspaceRoot),
            ],
          })
        : projects;
    const snapshots = buildSidebarProjectSnapshots({
      projects: orderedProjects,
      settings: groupingSettings,
      primaryEnvironmentId,
      resolveEnvironmentLabel: (environmentId) => environmentLabelById.get(environmentId) ?? null,
    });
    const sorted = sortSidebarV2ProjectGroups(snapshots, threads, projectSortOrder);
    const { topLevel, runningByParentKey } = nestRunningSubagents(threads);
    const threadsByWorkspace = groupThreadsByWorkspace(sorted, topLevel);
    return sorted.map((project): WorkspaceGroup => {
      const workspaceThreads = sortThreads(
        threadsByWorkspace.get(project.projectKey) ?? [],
        threadSortOrder,
      );
      const isScratch = project.memberProjects.some((member) =>
        isScratchProject(member, serverConfigs.get(member.environmentId)?.scratchWorkspaceRoot),
      );
      const subagents = new Map<string, ReadonlyArray<SidebarThreadSummary>>();
      for (const thread of workspaceThreads) {
        const key = `${thread.environmentId}:${thread.id}`;
        const running = runningByParentKey.get(key);
        if (running) subagents.set(key, running);
      }
      return {
        project,
        name: workspaceDisplayName({ displayName: project.displayName, isScratch }),
        isScratch,
        threads: workspaceThreads,
        runningSubagentsByParentKey: subagents,
      };
    });
  }, [
    environments,
    groupingSettings,
    primaryEnvironmentId,
    projectOrder,
    projectSortOrder,
    projects,
    serverConfigs,
    threadSortOrder,
    threads,
  ]);
}
