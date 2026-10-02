import { useEffect, type RefObject } from "react";

import {
  onComposerControlRequest,
  useStatusBarStore,
  type StatusBarActiveThread,
} from "../../statusBarStore";

/**
 * The composer's side of the status bar: publishes the model label and context
 * percent for the open thread, and clears them when the thread closes. A null
 * `threadKey` (a draft with no thread yet) publishes nothing.
 */
export function usePublishStatusBarThreadInfo(input: {
  readonly threadKey: string | null;
  readonly modelLabel: string | null;
  readonly contextPercent: number | null;
}): void {
  const { threadKey, modelLabel, contextPercent } = input;
  useEffect(() => {
    if (threadKey === null) return;
    const { publish, clear } = useStatusBarStore.getState();
    publish({ threadKey, modelLabel, contextPercent });
    return () => clear(threadKey);
  }, [threadKey, modelLabel, contextPercent]);
}

/** ChatView's side: says which thread (or draft) is open so the bar can follow it. */
export function usePublishStatusBarActiveThread(active: StatusBarActiveThread | null): void {
  const threadKey = active?.threadKey ?? null;
  const branch = active?.branch ?? null;
  const projectName = active?.projectName ?? null;
  const hostLabel = active?.hostLabel ?? null;
  const ref = active?.ref ?? null;
  useEffect(() => {
    if (threadKey === null || ref === null) return;
    const { publishActive, clearActive } = useStatusBarStore.getState();
    publishActive({ threadKey, ref, branch, projectName, hostLabel });
    return () => clearActive(threadKey);
  }, [threadKey, ref, branch, projectName, hostLabel]);
}

interface ComposerControlTarget {
  toggleModelPicker: () => void;
  openControl: (command: "composer.workspace") => void;
}

/** Lets the status bar open the composer's model and branch pickers. */
export function useStatusBarComposerControls(
  composerRef: RefObject<ComposerControlTarget | null>,
): void {
  useEffect(
    () =>
      onComposerControlRequest((control) => {
        if (control === "model") composerRef.current?.toggleModelPicker();
        else composerRef.current?.openControl("composer.workspace");
      }),
    [composerRef],
  );
}
