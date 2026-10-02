import type { ThreadAutonomousState } from "@t3tools/contracts";
import { useEffect, useReducer, useRef } from "react";

import { toastManager } from "../components/ui/toast";
import {
  detectAutonomousDone,
  reduceSparkle,
  snapshotAutonomous,
  type AutonomousSnapshot,
} from "./delights.logic";
import { useDelightsEnabled } from "./delightsSetting";

/**
 * Watches one thread's autonomous state and, when a run finishes with "done",
 * shows the "All done" toast once and returns a changing token the chip uses
 * as the key of its one-shot sparkle. Returns 0 until a run finishes here.
 * Mount it once per visible thread view.
 */
export function useAutonomousDoneSparkle(
  threadKey: string | null,
  autonomous: ThreadAutonomousState | null | undefined,
): number {
  const enabled = useDelightsEnabled();
  const previous = useRef<AutonomousSnapshot | null>(null);
  const [sparkle, dispatch] = useReducer(reduceSparkle, { threadKey: null, token: 0 });

  const isEnabled = autonomous?.enabled === true;
  const count = autonomous?.count ?? 0;
  const stopReason = autonomous?.stopReason ?? null;

  // A thread change clears the sparkle, so coming back never replays it.
  useEffect(() => {
    dispatch({ type: "thread", threadKey });
  }, [threadKey]);

  useEffect(() => {
    if (threadKey === null) {
      previous.current = null;
      return;
    }
    const next = snapshotAutonomous(threadKey, { enabled: isEnabled, count, stopReason });
    const done = detectAutonomousDone(previous.current, next);
    previous.current = next;
    if (done === null || !enabled || document.visibilityState === "hidden") return;
    dispatch({ type: "done", threadKey });
    toastManager.add({
      type: "success",
      title: "All done ✨",
      description: `Finished in ${done.turns} ${done.turns === 1 ? "turn" : "turns"}.`,
    });
  }, [threadKey, isEnabled, count, stopReason, enabled]);

  return sparkle.threadKey === threadKey && enabled ? sparkle.token : 0;
}
