import type { ThreadAutonomousState } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";

import { toastManager } from "../components/ui/toast";
import {
  detectAutonomousDone,
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
  const [sparkle, setSparkle] = useState<{ threadKey: string; token: number } | null>(null);

  const isEnabled = autonomous?.enabled === true;
  const count = autonomous?.count ?? 0;
  const stopReason = autonomous?.stopReason ?? null;

  useEffect(() => {
    if (threadKey === null) {
      previous.current = null;
      return;
    }
    const next = snapshotAutonomous(threadKey, { enabled: isEnabled, count, stopReason });
    const done = detectAutonomousDone(previous.current, next);
    previous.current = next;
    if (done === null || !enabled || document.visibilityState === "hidden") return;
    setSparkle((current) => ({ threadKey, token: (current?.token ?? 0) + 1 }));
    toastManager.add({
      type: "success",
      title: "All done ✨",
      description: `Finished in ${done.turns} ${done.turns === 1 ? "turn" : "turns"}.`,
    });
  }, [threadKey, isEnabled, count, stopReason, enabled]);

  return sparkle !== null && sparkle.threadKey === threadKey && enabled ? sparkle.token : 0;
}
