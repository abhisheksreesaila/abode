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
import { chooseModel, sessionTitle } from "../newSession";
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
    const project = workspace.newSessionTarget;
    if (project === undefined) return "This workspace has no project to start a session in.";
    const entry = resolveSelectableProviderInstanceEntry(
      deriveProviderInstanceEntries(providers),
      undefined,
    );
    const fallbackModel = entry
      ? getDefaultProviderInstanceModel(providers, entry.instanceId)
      : undefined;
    const modelSelection = chooseModel(
      project.defaultModelSelection,
      entry && fallbackModel ? { instanceId: entry.instanceId, model: fallbackModel } : null,
    );
    if (modelSelection === null) return "No model is available to start a session.";
    const threadId = newThreadId();
    const title = sessionTitle(text);
    const createdAt = new Date().toISOString();
    const result = await startTurn({
      environmentId: project.environmentId,
      input: {
        threadId,
        message: { messageId: newMessageId(), role: "user", text, attachments: [] },
        modelSelection,
        titleSeed: title,
        runtimeMode: "approval-required",
        interactionMode: "default",
        bootstrap: {
          createThread: {
            projectId: project.id,
            title,
            modelSelection,
            runtimeMode: "approval-required",
            interactionMode: "default",
            branch: null,
            worktreePath: null,
            createdAt,
          },
        },
        createdAt,
      },
    });
    if (result._tag !== "Success") {
      const failure = squashAtomCommandFailure(result);
      return failure instanceof Error ? failure.message : "Could not start the session.";
    }
    useDrawerStore
      .getState()
      .open(threadShellKey({ environmentId: project.environmentId, id: threadId }));
    return null;
  };
}
