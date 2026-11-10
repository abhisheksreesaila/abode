import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";

import { primaryServerProvidersAtom, serverEnvironment } from "~/state/server";
import { useThreadShell } from "~/state/entities";
import { useAtomCommand } from "~/state/use-atom-command";

import { skillRefreshInstanceIds } from "./customizationsModel";

/**
 * Asks the server to re-scan providers for skills, so a skill written or saved here shows in the
 * composer's `/` picker now instead of after the snapshot's TTL. The scan uses the thread's own
 * checkout (`worktreePath`), like the composer does: a skill written to the project root is not
 * in a checkout copy until it is committed there.
 */
export function useRefreshProviderSkills(input: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef | null;
  readonly workspaceRoot: string;
}): () => void {
  const { environmentId, threadRef, workspaceRoot } = input;
  const shell = useThreadShell(threadRef);
  const providers = useAtomValue(primaryServerProvidersAtom);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const threadInstanceId = shell?.modelSelection.instanceId;
  const cwd = shell?.worktreePath ?? workspaceRoot;
  return () => {
    for (const instanceId of skillRefreshInstanceIds(threadInstanceId, providers)) {
      void refreshProviders({ environmentId, input: { instanceId, cwd, fresh: true } });
    }
  };
}
