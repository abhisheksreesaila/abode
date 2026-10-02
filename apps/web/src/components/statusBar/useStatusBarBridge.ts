import { useEffect, type RefObject } from "react";

import { onComposerControlRequest, useStatusBarStore } from "../../statusBarStore";

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
