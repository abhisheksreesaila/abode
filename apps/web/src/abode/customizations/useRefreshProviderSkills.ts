import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { useCallback } from "react";

import { serverEnvironment } from "~/state/server";
import { useThreadShell } from "~/state/entities";
import { useAtomCommand } from "~/state/use-atom-command";

/** The providers whose skills Customizations edits. */
const SKILL_DRIVERS: ReadonlySet<string> = new Set(["claudeAgent", "codex"]);

/**
 * Asks the server to re-scan the thread's provider for skills, so a skill written or saved here
 * shows in the composer's `/` picker now instead of after the snapshot's TTL. The scan uses the
 * thread's own checkout (`worktreePath`), like the composer does: a skill written to the project
 * root is not in a checkout copy until it is committed there. A new-thread draft has no provider
 * yet, so every Claude and Codex instance rescans the workspace.
 */
export function useRefreshProviderSkills(input: {
  readonly environmentId: EnvironmentId;
  readonly threadRef: ScopedThreadRef | null;
  readonly workspaceRoot: string;
}): () => void {
  const { environmentId, threadRef, workspaceRoot } = input;
  const shell = useThreadShell(threadRef);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const instanceId = shell?.modelSelection.instanceId;
  const cwd = shell?.worktreePath ?? workspaceRoot;
  return useCallback(() => {
    if (instanceId) {
      void refreshProviders({ environmentId, input: { instanceId, cwd, fresh: true } });
      return;
    }
    void refreshProviders({ environmentId, input: {} }).then((result) => {
      if (result._tag !== "Success") return;
      for (const provider of result.value.providers) {
        if (!SKILL_DRIVERS.has(provider.driver)) continue;
        void refreshProviders({
          environmentId,
          input: { instanceId: provider.instanceId, cwd, fresh: true },
        });
      }
    });
  }, [cwd, environmentId, instanceId, refreshProviders]);
}
