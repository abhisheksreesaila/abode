import { useUiStateStore } from "~/uiStateStore";

import { deriveWorkspaceThreadState } from "../shell/threadState";
import { useWorkspaceGroups } from "../shell/useWorkspaceGroups";
import { threadShellKey } from "../shell/workspaceModel";
import { groupRailItems, workspaceGroup, type RailGroup } from "./railGroups";

export interface CanvasWorkspace {
  readonly key: string;
  readonly name: string;
  readonly group: RailGroup;
}

/** The real projects for the rail, grouped from live thread state the way the sidebar reads it. */
export function useCanvasWorkspaces(): CanvasWorkspace[] {
  const groups = useWorkspaceGroups();
  const visits = useUiStateStore((state) => state.threadLastVisitedAtById);
  return groupRailItems(
    groups
      .filter((group) => !group.isScratch)
      .map((group) => ({
        key: group.project.projectKey,
        name: group.name,
        group: workspaceGroup(
          group.threads.map((thread) =>
            deriveWorkspaceThreadState(thread, visits[threadShellKey(thread)]),
          ),
        ),
      })),
  );
}
