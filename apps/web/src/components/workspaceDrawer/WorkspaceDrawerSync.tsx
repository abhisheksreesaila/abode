import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useEffect, useRef } from "react";

import { readThreadPreviewState, useThreadPreviewState } from "../../previewStateStore";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { previewEnvironment } from "../../state/preview";
import { useAtomCommand } from "../../state/use-atom-command";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import { restoreWorkspaceDrawer } from "../../workspaceDrawerRestore";
import {
  recordFromThread,
  useWorkspaceDrawerStore,
  type ThreadDrawerSnapshot,
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

/** True when the thread's drawer, terminal or browser URL differs from `baseline`. */
function changedSince(current: ThreadDrawerSnapshot, baseline: ThreadDrawerSnapshot): boolean {
  return (
    current.panel !== baseline.panel ||
    current.terminalOpen !== baseline.terminalOpen ||
    current.browserUrl !== baseline.browserUrl
  );
}

/**
 * Renders nothing. While `threadRef` is the open thread it (1) applies its
 * workspace's remembered drawer to the thread whenever the thread changes, and
 * (2) copies later drawer, terminal and browser changes back into the
 * workspace record. Every toggle (keybinding, palette, status bar, close
 * button) goes through the thread stores, so recording at the store level
 * covers them all. Recording only reacts to changes made after the restore,
 * so a thread that was left as it was (sheet layout) never overwrites the
 * workspace's choice.
 */
export function WorkspaceDrawerSync(props: {
  threadRef: ScopedThreadRef;
  workspaceKey: string;
  configuredPreviewUrls: ReadonlyArray<string>;
  sheetLayout: boolean;
}) {
  const { threadRef, workspaceKey } = props;
  const threadKey = scopedThreadKey(threadRef);
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  // Latest values for the restore effect, which must run only when the thread changes.
  const latest = useRef({ props, openPreview });
  useEffect(() => {
    latest.current = { props, openPreview };
  });
  // Set once the thread has been reconciled with its workspace; recording waits for it.
  const baseline = useRef<ThreadDrawerSnapshot | null>(null);
  const preview = useThreadPreviewState(threadRef);
  const previewUrl =
    preview.snapshot && preview.snapshot.navStatus._tag !== "Idle"
      ? preview.snapshot.navStatus.url
      : null;

  useEffect(() => {
    let cancelled = false;
    const { threadRef } = latest.current.props;
    baseline.current = null;

    const recordIfChanged = () => {
      const base = baseline.current;
      if (!base) return;
      const current = readThreadSnapshot(threadRef);
      if (!changedSince(current, base)) return;
      const state = useWorkspaceDrawerStore.getState();
      state.setRecord(
        workspaceKey,
        recordFromThread(state.byWorkspaceKey[workspaceKey], current, Date.now()),
      );
    };

    const record = useWorkspaceDrawerStore.getState().byWorkspaceKey[workspaceKey];
    const run = async () => {
      if (!record) return { applied: true };
      const { props: p, openPreview: open } = latest.current;
      return restoreWorkspaceDrawer({
        record,
        configuredPreviewUrls: p.configuredPreviewUrls,
        sheetLayout: p.sheetLayout,
        readThread: () => readThreadSnapshot(threadRef),
        terminalHasSessions: () =>
          selectThreadTerminalUiState(
            useTerminalUiStateStore.getState().terminalUiStateByThreadKey,
            threadRef,
          ).terminalIds.length > 0,
        // Browser sessions are per thread on the server, so a thread without one loads the saved URL.
        openBrowserSession: async (url) => {
          const result = await openPreviewSession({ openPreview: open, threadRef, url });
          return result._tag === "Success" ? result.value.tabId : null;
        },
        applyPanel: (application) =>
          useRightPanelStore.getState().applyWorkspaceDrawer(threadRef, application),
        setTerminalOpen: (open) =>
          useTerminalUiStateStore.getState().setTerminalOpen(threadRef, open),
        isCancelled: () => cancelled,
      });
    };
    void run().then(({ applied }) => {
      if (cancelled) return;
      baseline.current = readThreadSnapshot(threadRef);
      // An unrestored thread (sheet layout) is not the workspace's choice: wait for a real change.
      if (applied) {
        const state = useWorkspaceDrawerStore.getState();
        state.setRecord(
          workspaceKey,
          recordFromThread(state.byWorkspaceKey[workspaceKey], baseline.current, Date.now()),
        );
      }
    });

    const unsubscribeRight = useRightPanelStore.subscribe(recordIfChanged);
    const unsubscribeTerminal = useTerminalUiStateStore.subscribe(recordIfChanged);
    return () => {
      cancelled = true;
      unsubscribeRight();
      unsubscribeTerminal();
    };
  }, [threadKey, workspaceKey]);

  useEffect(() => {
    const base = baseline.current;
    if (!base) return;
    const current = {
      ...readThreadSnapshot(latest.current.props.threadRef),
      browserUrl: previewUrl,
    };
    if (!changedSince(current, base)) return;
    const state = useWorkspaceDrawerStore.getState();
    state.setRecord(
      workspaceKey,
      recordFromThread(state.byWorkspaceKey[workspaceKey], current, Date.now()),
    );
  }, [previewUrl, threadKey, workspaceKey]);

  return null;
}
