import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useEnvironments } from "~/state/environments";
import { useUiStateStore } from "~/uiStateStore";

import { deriveWorkspaceThreadState } from "../shell/threadState";
import { useWorkspaceGroups } from "../shell/useWorkspaceGroups";
import { threadShellKey } from "../shell/workspaceModel";
import { useSessionDetails } from "./useSessionDetails";
import {
  buildWorkspaceRows,
  needsSessionDetail,
  sessionActivityAt,
  type SessionSummary,
  type WorkspaceInput,
} from "./workspaceRows";

/**
 * Everything the Control room reads: the workspaces as plain inputs, the rows
 * built from them, and where each session lives. Only running and needs-you
 * sessions get a projection subscription.
 */
export function useControlRoomRows() {
  const groups = useWorkspaceGroups();
  const { environments } = useEnvironments();
  const visits = useUiStateStore((state) => state.threadLastVisitedAtById);

  const labelById = new Map(
    environments.map((environment) => [environment.environmentId as string, environment.label]),
  );
  const refByKey = new Map<string, ScopedThreadRef>();
  const detailRefs: ScopedThreadRef[] = [];
  const workspaces = groups.map((group): WorkspaceInput => {
    const sessions = group.threads.map((thread): SessionSummary => {
      const key = threadShellKey(thread);
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      refByKey.set(key, ref);
      const state = deriveWorkspaceThreadState(thread, visits[key]);
      if (needsSessionDetail(state)) detailRefs.push(ref);
      return {
        key,
        environmentId: thread.environmentId,
        environmentLabel: labelById.get(thread.environmentId) ?? "Unknown machine",
        state,
        activityAt: sessionActivityAt(state, {
          latestUserMessageAt: thread.latestUserMessageAt,
          updatedAt: thread.updatedAt,
          runtimeUpdatedAt: thread.runtime?.updatedAt ?? null,
          createdAt: thread.createdAt,
        }),
        runningSubagents:
          group.runningSubagentsByParentKey.get(`${thread.environmentId}:${thread.id}`)?.length ??
          0,
      };
    });
    return { key: group.project.projectKey, name: group.name, sessions };
  });

  const details = useSessionDetails(detailRefs);
  return { workspaces, rows: buildWorkspaceRows(workspaces, details), refByKey };
}
