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
import { resolveSidebarThreadStatus } from "../../components/Sidebar.logic";
import type { SidebarThreadSummary } from "../../types";
import {
  deriveFeed,
  type DoneMilestone,
  type FeedInput,
  type FeedItem,
  type FeedSession,
} from "./feedModel";
import { usageMeters, type OverviewWorkspace, type UsageMeter } from "./overviewModel";
import type { CanvasWorkspace } from "./useCanvasWorkspaces";

/** Done milestones each Row last read from plan.md; rows overwrite their entry, nothing clears it. */
const useLiveDoneStore = create<{
  readonly byWorkspace: Readonly<Record<string, ReadonlyArray<DoneMilestone>>>;
  publish: (workspaceKey: string, done: ReadonlyArray<DoneMilestone>) => void;
}>()((set) => ({
  byWorkspace: {},
  // Same milestones again is a no-op: rows publish from an effect on a fresh array each render.
  publish: (workspaceKey, done) =>
    set((state) => {
      const before = state.byWorkspace[workspaceKey];
      const same =
        before !== undefined &&
        before.length === done.length &&
        before.every((m, i) => m.key === done[i]!.key && m.name === done[i]!.name);
      return same ? state : { byWorkspace: { ...state.byWorkspace, [workspaceKey]: done } };
    }),
}));

/** A Row reports its workspace's done milestones once its plan.md was read (`null` before). */
export function usePublishDoneMilestones(
  workspaceKey: string,
  done: ReadonlyArray<DoneMilestone> | null,
) {
  const publish = useLiveDoneStore((state) => state.publish);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- hands the row's plan read to the feed store
  useEffect(() => {
    if (done !== null) publish(workspaceKey, done);
  }, [workspaceKey, done, publish]);
}

interface LastSeenStore {
  /** When this device last closed the overview (epoch ms); null before the first close. */
  readonly lastSeenAt: number | null;
  /** Done milestone keys per workspace as of that close; the feed's "reached" diffs against it. */
  readonly doneSnapshot: Readonly<Record<string, ReadonlyArray<string>>>;
  markSeen: () => void;
}

/** Per-device, client-only: "since last look" counts from here (the feed reads it). */
export const useLastSeenStore = create<LastSeenStore>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      doneSnapshot: {},
      markSeen: () =>
        set((state) => {
          const doneSnapshot = { ...state.doneSnapshot };
          for (const [key, done] of Object.entries(useLiveDoneStore.getState().byWorkspace)) {
            doneSnapshot[key] = done.map((milestone) => milestone.key);
          }
          return { lastSeenAt: Date.now(), doneSnapshot };
        }),
    }),
    {
      name: "abode:overview:v1",
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: ({ lastSeenAt, doneSnapshot }) => ({ lastSeenAt, doneSnapshot }),
    },
  ),
);

function sessionOutcome(thread: SidebarThreadSummary): FeedSession["outcome"] {
  const status = resolveSidebarThreadStatus(thread);
  if (status === "approval" || status === "input") return "waiting";
  if (status === "failed") return "failed";
  if (status === "limited") return "limited";
  return thread.latestRun?.status === "completed" ? "completed" : "other";
}

/**
 * The feed from live thread state and the done milestones the open rows reported. No PR items:
 * the client only holds pull request state per open thread panel, not per workspace.
 */
export function useOverviewFeed(workspaces: ReadonlyArray<CanvasWorkspace>): {
  readonly items: FeedItem[];
  readonly now: number;
} {
  const groups = useWorkspaceGroups();
  const done = useLiveDoneStore((state) => state.byWorkspace);
  const lastSeenAt = useLastSeenStore((state) => state.lastSeenAt);
  const doneSnapshot = useLastSeenStore((state) => state.doneSnapshot);
  // Fixed at mount like the meters: the overview is short-lived.
  const [now] = useState(Date.now);
  const names = new Map(workspaces.map((workspace) => [workspace.key, workspace.name]));
  const input: FeedInput = {
    sessions: groups.flatMap((group) => {
      const workspaceName = names.get(group.project.projectKey);
      return workspaceName === undefined
        ? []
        : group.threads.map((thread) => ({
            workspaceKey: group.project.projectKey,
            workspaceName,
            sessionKey: threadShellKey(thread),
            title: thread.title,
            outcome: sessionOutcome(thread),
            at: Date.parse(thread.latestRun?.completedAt ?? thread.updatedAt) || 0,
          }));
    }),
    milestones: Object.entries(done).flatMap(([workspaceKey, list]) => {
      const workspaceName = names.get(workspaceKey);
      return workspaceName === undefined ? [] : [{ workspaceKey, workspaceName, done: list }];
    }),
    snapshot: doneSnapshot,
    now,
  };
  return { items: deriveFeed(input, lastSeenAt), now };
}

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
