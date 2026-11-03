import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts, collectLimitPools } from "@t3tools/shared/usageLimits";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";
import { environmentPresentations } from "../../state/presentation";
import { useUiStateStore } from "../../uiStateStore";
import { deriveWorkspaceThreadState } from "../shell/threadState";
import { useWorkspaceGroups } from "../shell/useWorkspaceGroups";
import { threadShellKey } from "../shell/workspaceModel";
import { isLayerOpen, overviewKeyAction } from "./overviewKeys";
import { usageMeters, type OverviewWorkspace, type UsageMeter } from "./overviewModel";
import type { CanvasWorkspace } from "./useCanvasWorkspaces";

interface LastSeenStore {
  /** When this device last closed the overview (epoch ms); null before the first close. */
  readonly lastSeenAt: number | null;
  markSeen: () => void;
}

/** Per-device, client-only: "since last look" counts from here (A-049 reads it for the feed). */
export const useLastSeenStore = create<LastSeenStore>()(
  persist((set) => ({ lastSeenAt: null, markSeen: () => set({ lastSeenAt: Date.now() }) }), {
    name: "abode:overview:v1",
    version: 1,
    storage: createJSONStorage(() =>
      resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
    ),
    partialize: ({ lastSeenAt }) => ({ lastSeenAt }),
  }),
);

/** One input per workspace for the overview model: the rail data plus how many sessions run. */
export function useOverviewWorkspaces(
  workspaces: ReadonlyArray<CanvasWorkspace>,
): OverviewWorkspace[] {
  const groups = useWorkspaceGroups();
  const visits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const runningByKey = new Map(
    groups.map((group) => [
      group.project.projectKey,
      group.threads.filter(
        (thread) =>
          deriveWorkspaceThreadState(thread, visits[threadShellKey(thread)]).attention ===
          "running",
      ).length,
    ]),
  );
  return workspaces.map((workspace) => ({
    key: workspace.key,
    name: workspace.name,
    group: workspace.group,
    sessions: workspace.sessions.pills.length,
    running: runningByKey.get(workspace.key) ?? 0,
    red: workspace.sessions.pills.some((pill) => pill.status === "blocked"),
    environmentId: workspace.newSessionTarget?.environmentId,
  }));
}

/** Provider limit meters from the same presentations the Usage page pools (estimates). */
export function useUsageMeters(): UsageMeter[] {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  // Fixed at mount: the pools only need "now" for reset clocks, and the overview is short-lived.
  const [now] = useState(Date.now);
  return usageMeters(collectLimitPools(collectLimitAccounts(presentations), now));
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName);
}

/** Window key listener; the decision lives in `overviewKeyAction`. */
export function useOverviewKeys(open: boolean, toggle: () => void, close: () => void) {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- window key listener for the overview shortcut
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = overviewKeyAction(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          defaultPrevented: event.defaultPrevented,
          typing: isTyping(event.target),
        },
        { open, layerOpen: event.key === "Escape" && isLayerOpen() },
      );
      if (action === "close") close();
      else if (action === "toggle") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, toggle, close]);
}
