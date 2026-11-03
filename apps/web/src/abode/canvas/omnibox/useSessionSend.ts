import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { newMessageId } from "~/lib/utils";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { environmentThreadShells, threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

/**
 * Sends a user message to a started thread the way ChatView's `sendAppMessage` does:
 * `startTurn`, dispatch mode "queue" (a running turn queues it), the thread's own modes.
 * Resolves an error message, or null when the turn was accepted.
 */
export function useSessionSend() {
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  return async (environmentId: EnvironmentId, threadId: ThreadId, text: string) => {
    const shell = appAtomRegistry.get(
      environmentThreadShells.threadShellAtom(scopeThreadRef(environmentId, threadId)),
    );
    if (!shell) return "That session is gone.";
    const result = await startTurn({
      environmentId,
      input: {
        threadId,
        message: { messageId: newMessageId(), role: "user", text, attachments: [] },
        runtimeMode: shell.runtimeMode,
        interactionMode: shell.interactionMode,
        dispatchMode: "queue",
      },
    });
    if (result._tag === "Success") return null;
    const error = squashAtomCommandFailure(result);
    return error instanceof Error ? error.message : "Could not send the message.";
  };
}
