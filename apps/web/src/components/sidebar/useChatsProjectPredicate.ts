import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback } from "react";

import { useEnvironments } from "../../state/environments";

interface ProjectLike {
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string;
}

/**
 * Whether a folder is the no-project "Chats" folder: an environment's Scratch project.
 * Takes a sidebar group (one or more members) so grouped projects count as one.
 */
export function useIsChatsProject() {
  const { environments } = useEnvironments();
  return useCallback(
    (group: { readonly memberProjects: readonly ProjectLike[] }) =>
      group.memberProjects.some((member) => {
        const environment = environments.find(
          (entry) => entry.environmentId === member.environmentId,
        );
        return isScratchProject(member, environment?.serverConfig?.scratchWorkspaceRoot ?? null);
      }),
    [environments],
  );
}
