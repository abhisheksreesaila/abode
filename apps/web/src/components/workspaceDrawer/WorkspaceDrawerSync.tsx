import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useEffect, useRef } from "react";

import { requestPanelToggle } from "../../panelToggleBus";
import { readThreadPreviewState, useThreadPreviewState } from "../../previewStateStore";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { previewEnvironment } from "../../state/preview";
import { useAtomCommand } from "../../state/use-atom-command";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import {
  planWorkspaceDrawerRestore,
  recordFromThread,
  useWorkspaceDrawerStore,
  type ThreadDrawerSnapshot,
  type WorkspaceDrawerTab,
} from "../../workspaceDrawerStore";
import { openPreviewSession } from "../preview/openPreviewSession";

function readThreadSnapshot(threadRef: ScopedThreadRef): ThreadDrawerSnapshot {
  const { snapshot } = readThreadPreviewState(threadRef);
  return {
    panel: selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef),
    terminalOpen: selectThreadTerminalUiState(
      useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
      threadRef,
    ).terminalOpen,
    browserUrl: snapshot && snapshot.navStatus._tag !== "Idle" ? snapshot.navStatus.url : null,
  };
}

function activateTab(threadRef: ScopedThreadRef, tab: WorkspaceDrawerTab): void {
  const store = useRightPanelStore.getState();
  switch (tab.kind) {
    case "files":
    case "diff":
      store.open(threadRef, tab.kind);
      return;
    case "file":
      store.openFile(threadRef, tab.relativePath);
      return;
    case "preview": {
      const surface = selectThreadRightPanelState(store.byThreadKey, threadRef).surfaces.find(
        (entry) => entry.kind === "preview",
      );
      if (surface) store.activateSurface(threadRef, surface.id);
      return;
    }
  }
}

/**
 * Renders nothing. While `threadRef` is the open thread it (1) applies its
 * workspace's remembered drawer to the thread whenever the thread changes, and
 * (2) copies later drawer, terminal and browser changes back into the
 * workspace record. Every toggle (keybinding, palette, status bar, close
 * button) goes through the thread stores, so recording at the store level
 * covers them all.
 */
export function WorkspaceDrawerSync(props: {
  threadRef: ScopedThreadRef;
  workspaceKey: string;
  configuredPreviewUrls: ReadonlyArray<string>;
}) {
  const { threadRef, workspaceKey } = props;
  const threadKey = scopedThreadKey(threadRef);
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  // Latest values for the restore effect, which must run only when the thread changes.
  const latest = useRef({ props, openPreview });
  latest.current = { props, openPreview };
  // The thread whose drawer has been reconciled with its workspace; recording waits for it.
  const syncedThreadKey = useRef<string | null>(null);
  const preview = useThreadPreviewState(threadRef);
  const previewUrl =
    preview.snapshot && preview.snapshot.navStatus._tag !== "Idle"
      ? preview.snapshot.navStatus.url
      : null;

  useEffect(() => {
    let cancelled = false;
    syncedThreadKey.current = null;
    const { configuredPreviewUrls } = latest.current.props;
    const record = useWorkspaceDrawerStore.getState().byWorkspaceKey[workspaceKey];

    const finish = () => {
      if (cancelled) return;
      syncedThreadKey.current = threadKey;
      recordCurrent();
    };
    const recordCurrent = () => {
      if (syncedThreadKey.current !== threadKey) return;
      const state = useWorkspaceDrawerStore.getState();
      const next = recordFromThread(
        state.byWorkspaceKey[workspaceKey],
        readThreadSnapshot(threadRef),
        Date.now(),
      );
      state.setRecord(workspaceKey, next);
    };

    const run = async () => {
      if (!record) return;
      const plan = planWorkspaceDrawerRestore(
        record,
        readThreadSnapshot(threadRef),
        configuredPreviewUrls,
      );
      const panel = useRightPanelStore.getState();
      if (!plan.drawerOpen) {
        panel.close(threadRef);
      } else {
        if (plan.ensureFiles) panel.open(threadRef, "files");
        if (plan.openBrowser) {
          const { url } = plan.openBrowser;
          if (url === null) {
            panel.openBrowser(threadRef, null);
          } else {
            // The previous session of another thread cannot be shared (sessions are
            // per thread on the server), so this reloads the saved URL once.
            const result = await openPreviewSession({
              openPreview: latest.current.openPreview,
              threadRef,
              url,
            });
            if (result._tag === "Success") {
              useRightPanelStore.getState().openBrowser(threadRef, result.value.tabId);
            } else {
              useRightPanelStore.getState().openBrowser(threadRef, null);
            }
          }
        }
        if (cancelled) return;
        if (plan.activate) activateTab(threadRef, plan.activate);
        useRightPanelStore.getState().show(threadRef);
      }
      if (plan.terminal === "close") {
        useTerminalUiStateStore.getState().setTerminalOpen(threadRef, false);
      } else if (plan.terminal === "open") {
        // Opening may need a server terminal, which only the chat view knows how to start.
        requestPanelToggle("terminal");
      }
    };
    void run().finally(finish);

    const unsubscribeRight = useRightPanelStore.subscribe(recordCurrent);
    const unsubscribeTerminal = useTerminalUiStateStore.subscribe(recordCurrent);
    return () => {
      cancelled = true;
      unsubscribeRight();
      unsubscribeTerminal();
    };
    // The restore runs once per thread; changes are copied back by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey, workspaceKey]);

  useEffect(() => {
    if (syncedThreadKey.current !== threadKey) return;
    const state = useWorkspaceDrawerStore.getState();
    state.setRecord(
      workspaceKey,
      recordFromThread(
        state.byWorkspaceKey[workspaceKey],
        readThreadSnapshot(threadRef),
        Date.now(),
      ),
    );
  }, [previewUrl, threadKey, threadRef, workspaceKey]);

  return null;
}
