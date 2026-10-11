import type {
  SidebarProjectGroupMember,
  SidebarProjectSnapshot,
} from "../../sidebarProjectGrouping";
import { sortSidebarV2ProjectGroups } from "../../components/Sidebar.logic";
import { sortThreads } from "../../lib/threadSort";
import type { SidebarThreadSummary } from "../../types";
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
 * The workspace tree from upstream's project groups and thread shells: sorted
 * like upstream's sidebar, with subagents nested under their top-level session.
 */
export function buildWorkspaceGroups(input: {
  readonly snapshots: ReadonlyArray<SidebarProjectSnapshot>;
  readonly threads: ReadonlyArray<SidebarThreadSummary>;
  readonly projectSortOrder: Parameters<typeof sortSidebarV2ProjectGroups>[2];
  readonly threadSortOrder: Parameters<typeof sortThreads>[1];
  readonly isScratchMember: (member: SidebarProjectGroupMember) => boolean;
}): WorkspaceGroup[] {
  const sorted = sortSidebarV2ProjectGroups(input.snapshots, input.threads, input.projectSortOrder);
  const { topLevel, runningByParentKey } = nestRunningSubagents(input.threads);
  const threadsByWorkspace = groupThreadsByWorkspace(sorted, topLevel);
  return sorted.map((project): WorkspaceGroup => {
    const workspaceThreads = sortThreads(
      threadsByWorkspace.get(project.projectKey) ?? [],
      input.threadSortOrder,
    );
    const isScratch = project.memberProjects.some(input.isScratchMember);
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
}
