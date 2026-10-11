import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { useMemo } from "react";

import { orderItemsByPreferredIds } from "../../components/Sidebar.logic";
import { useClientSettings } from "../../hooks/useSettings";
import { getProjectOrderKey, selectProjectGroupingSettings } from "../../logicalProject";
import { buildSidebarProjectSnapshots } from "../../sidebarProjectGrouping";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { useProjects, useServerConfigs, useThreadShells } from "../../state/entities";
import { legacyProjectCwdPreferenceKey, useUiStateStore } from "../../uiStateStore";
import { buildWorkspaceGroups, type WorkspaceGroup } from "./workspaceGroups";

export type { WorkspaceGroup };

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
    return buildWorkspaceGroups({
      snapshots,
      threads,
      projectSortOrder,
      threadSortOrder,
      isScratchMember: (member) =>
        isScratchProject(member, serverConfigs.get(member.environmentId)?.scratchWorkspaceRoot),
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
