import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  settlePromise,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { threadRuntimeCanArchive } from "@t3tools/client-runtime/state/models";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type ScopedThreadRef,
  type ThreadId,
} from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";

import {
  buildThreadActionMenuItems,
  threadActionRequiresOperate,
} from "../../components/threadActionMenu.logic";
import { canShareWithGuestAtom } from "../../components/chat/guestShareAvailability";
import { openGuestShareDialog } from "../../components/chat/guestShareDialogState";
import { stackedThreadToast, toastManager } from "../../components/ui/toast";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useClientSettings } from "../../hooks/useSettings";
import { useThreadActions } from "../../hooks/useThreadActions";
import { readLocalApi } from "../../localApi";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { useServerConfigs } from "../../state/entities";
import { readEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { archiveFailureTitle } from "./archiveFailure";
import type { SidebarThreadSummary } from "../../types";

// Same text as upstream's (private) denial in use-orchestration-command.
const ORCHESTRATION_OPERATE_DENIED_MESSAGE = "This connection cannot change threads or projects.";

function reportError(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : "An error occurred.",
    }),
  );
}

export function checkOperatePermission(environmentId: EnvironmentId): boolean {
  if (readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) return true;
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title: "Action unavailable",
      description: ORCHESTRATION_OPERATE_DENIED_MESSAGE,
    }),
  );
  return false;
}

export interface ThreadMenuRequest {
  readonly thread: SidebarThreadSummary;
  /** The folder the thread works in when it has no worktree of its own. */
  readonly workspaceRoot: string | null;
  /** The workspace's logical key, for "Project settings". */
  readonly workspaceKey: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly startRename: () => void;
}

/**
 * The actions behind a session row. Menu contents come from upstream's shared
 * `buildThreadActionMenuItems`; abode only decides which capabilities it shows
 * (no pin, settle or snooze: the workspace tree lists every open session).
 */
export function useAbodeThreadActions() {
  const { archiveThread, deleteThread, markThreadUnread } = useThreadActions();
  const updateThreadMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const handleNewThread = useNewThreadHandler();
  const router = useRouter();
  const serverConfigs = useServerConfigs();
  const confirmThreadArchive = useClientSettings((settings) => settings.confirmThreadArchive);
  const confirmThreadDelete = useClientSettings((settings) => settings.confirmThreadDelete);
  const { copyToClipboard: copyPath } = useCopyToClipboard<{ path: string }>({
    onCopy: ({ path }) =>
      toastManager.add({ type: "success", title: "Path copied", description: path }),
    onError: (error) => reportError("Failed to copy path", error),
  });
  const { copyToClipboard: copyBranch } = useCopyToClipboard<{ branch: string }>({
    target: "branch name",
    onCopy: ({ branch }) =>
      toastManager.add({ type: "success", title: "Branch copied", description: branch }),
    onError: (error) => reportError("Failed to copy branch", error),
  });
  const { copyToClipboard: copyThreadId } = useCopyToClipboard<{ threadId: ThreadId }>({
    onCopy: ({ threadId }) =>
      toastManager.add({ type: "success", title: "Thread ID copied", description: threadId }),
    onError: (error) => reportError("Failed to copy thread ID", error),
  });

  const renameThread = async (
    threadRef: ScopedThreadRef,
    newTitle: string,
    originalTitle: string,
  ) => {
    const trimmed = newTitle.trim();
    if (trimmed.length === 0) {
      toastManager.add({ type: "warning", title: "Thread title cannot be empty" });
      return;
    }
    if (trimmed === originalTitle) return;
    const result = await updateThreadMetadata({
      environmentId: threadRef.environmentId,
      input: { threadId: threadRef.threadId, title: trimmed },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      reportError("Failed to rename thread", squashAtomCommandFailure(result));
    }
  };

  const attemptArchive = async (threadRef: ScopedThreadRef) => {
    if (!checkOperatePermission(threadRef.environmentId)) return;
    let didArchive = false;
    const result = await archiveThread(threadRef, {
      onArchived: () => {
        didArchive = true;
      },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      reportError(archiveFailureTitle(didArchive), squashAtomCommandFailure(result));
    }
  };

  /** The row's archive button and the menu's Archive item share this confirmation. */
  const archiveWithConfirm = async (threadRef: ScopedThreadRef, title: string) => {
    if (!checkOperatePermission(threadRef.environmentId)) return;
    if (confirmThreadArchive) {
      const api = readLocalApi();
      if (!api) return;
      const confirmed = await settlePromise(() =>
        api.dialogs.confirm(`Archive thread "${title}"?`),
      );
      if (confirmed._tag === "Failure" || !confirmed.value) return;
    }
    await attemptArchive(threadRef);
  };

  const showThreadMenu = async (request: ThreadMenuRequest) => {
    const api = readLocalApi();
    if (!api) return;
    const { thread } = request;
    const threadRef = scopeThreadRef(thread.environmentId, thread.id);
    const capabilities = serverConfigs.get(thread.environmentId)?.environment.capabilities;
    const workspacePath = thread.worktreePath ?? request.workspaceRoot;
    const clicked = await settlePromise(() =>
      api.contextMenu.show(
        buildThreadActionMenuItems({
          canOperate: readEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope),
          branch: thread.branch ?? null,
          projectFilter: null,
          isPinned: false,
          isSettled: false,
          autoSettleEnabled: true,
          isSnoozed: false,
          canSnoozeNow: false,
          isRegeneratingTitle: thread.titleRegeneration != null,
          isRunning: !threadRuntimeCanArchive(thread.runtime),
          canShareWithGuest: appAtomRegistry.get(canShareWithGuestAtom(thread.environmentId)),
          supports: {
            settlement: false,
            autoSettleOptOut: false,
            snooze: false,
            pinning: false,
            titleRegeneration: capabilities?.threadTitleRegeneration === true,
          },
          snoozePresets: [],
        }),
        request.position,
      ),
    );
    if (clicked._tag === "Failure" || clicked.value === null) return;
    const action = clicked.value;
    if (threadActionRequiresOperate(action) && !checkOperatePermission(thread.environmentId)) {
      return;
    }
    switch (action) {
      case "rename":
        request.startRename();
        return;
      case "mark-unread":
        markThreadUnread(threadRef);
        return;
      case "share-guest":
        openGuestShareDialog(threadRef);
        return;
      case "copy-path":
        if (!workspacePath) {
          reportError("Path unavailable", new Error("This thread has no workspace path."));
          return;
        }
        copyPath(workspacePath, { path: workspacePath });
        return;
      case "copy-branch":
        if (thread.branch) copyBranch(thread.branch, { branch: thread.branch });
        return;
      case "copy-thread-id":
        copyThreadId(thread.id, { threadId: thread.id });
        return;
      case "project-settings":
        void router.navigate({
          to: "/projects/$projectKey",
          params: { projectKey: request.workspaceKey },
        });
        return;
      case "new-thread-on-branch": {
        const result = await settlePromise(() =>
          handleNewThread(scopeProjectRef(thread.environmentId, thread.projectId), {
            branch: thread.branch,
            worktreePath: thread.worktreePath,
            envMode: thread.worktreePath ? "worktree" : "local",
            startFromOrigin: false,
          }),
        );
        if (result._tag === "Failure") {
          reportError("Could not create thread", squashAtomCommandFailure(result));
        }
        return;
      }
      case "regenerate-title": {
        if (thread.titleRegeneration != null) return;
        const result = await updateThreadMetadata({
          environmentId: threadRef.environmentId,
          input: { threadId: threadRef.threadId, regenerateTitle: true },
        });
        if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
          reportError("Failed to regenerate thread title", squashAtomCommandFailure(result));
        }
        return;
      }
      case "archive":
        await archiveWithConfirm(threadRef, thread.title);
        return;
      case "delete": {
        if (confirmThreadDelete) {
          const confirmed = await settlePromise(() =>
            api.dialogs.confirm(
              [
                `Delete thread "${thread.title}"?`,
                "This permanently clears conversation history for this thread.",
              ].join("\n"),
              { variant: "destructive" },
            ),
          );
          if (confirmed._tag === "Failure" || !confirmed.value) return;
        }
        const result = await deleteThread(threadRef);
        if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
          reportError("Failed to delete thread", squashAtomCommandFailure(result));
        }
        return;
      }
      default:
        return;
    }
  };

  return { archiveWithConfirm, renameThread, showThreadMenu };
}
