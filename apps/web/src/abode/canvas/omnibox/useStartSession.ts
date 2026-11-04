import { useAtomValue } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";

import { newMessageId, newThreadId } from "~/lib/utils";
import {
  deriveProviderInstanceEntries,
  getDefaultProviderInstanceModel,
  resolveSelectableProviderInstanceEntry,
} from "~/providerInstances";
import { primaryServerProvidersAtom } from "~/state/server";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { threadShellKey } from "../../shell/workspaceModel";
import { useDrawerStore } from "../drawerStore";
import { buildStartSession } from "../newSession";
import type { CanvasWorkspace } from "../useCanvasWorkspaces";

/**
 * Creates a session in the workspace with its first message, the way the Kit curator does:
 * one startTurn with bootstrap.createThread, approval-required, the project's default model.
 * Resolves an error message, or null once the thread exists; then the drawer opens on it.
 */
export function useStartSession() {
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  const providers = useAtomValue(primaryServerProvidersAtom);
  return async (workspace: CanvasWorkspace, text: string): Promise<string | null> => {
    // One start at a time, shared by the drawer's input and the bar.
    if (useDrawerStore.getState().starting) return "A session is already starting.";
    const project = workspace.newSessionTarget;
    const entry = resolveSelectableProviderInstanceEntry(
      deriveProviderInstanceEntries(providers),
      undefined,
    );
    const fallbackModel = entry
      ? getDefaultProviderInstanceModel(providers, entry.instanceId)
      : undefined;
    const command = buildStartSession({
      project,
      projectModel: project?.defaultModelSelection ?? null,
      fallbackModel:
        entry && fallbackModel ? { instanceId: entry.instanceId, model: fallbackModel } : null,
      text,
      threadId: newThreadId(),
      messageId: newMessageId(),
      createdAt: new Date().toISOString(),
    });
    if (command.error !== null) return command.error;
    useDrawerStore.getState().setStarting(true);
    const result = await startTurn({ environmentId: command.environmentId, input: command.input });
    useDrawerStore.getState().setStarting(false);
    if (result._tag !== "Success") {
      const failure = squashAtomCommandFailure(result);
      return failure instanceof Error ? failure.message : "Could not start the session.";
    }
    useDrawerStore
      .getState()
      .open(threadShellKey({ environmentId: command.environmentId, id: command.input.threadId }));
    return null;
  };
}
