import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";

export const FRAME_TABS = ["jam", "milestones", "design"] as const;
export type FrameTab = (typeof FRAME_TABS)[number];

const FRAME_STORAGE_KEY = "abode:frame:v1";

export function sanitizeFrameTabs(persisted: unknown): Record<string, FrameTab> {
  const saved = (persisted as { tabs?: unknown } | null)?.tabs;
  if (typeof saved !== "object" || saved === null || Array.isArray(saved)) return {};
  return Object.fromEntries(
    Object.entries(saved).filter(
      (entry): entry is [string, FrameTab] =>
        typeof entry[1] === "string" && (FRAME_TABS as ReadonlyArray<string>).includes(entry[1]),
    ),
  );
}

type OpenMap = Readonly<Record<string, Readonly<Record<string, boolean>>>>;

export function sanitizeMilestoneOpen(persisted: unknown): OpenMap {
  const saved = (persisted as { milestoneOpen?: unknown } | null)?.milestoneOpen;
  if (typeof saved !== "object" || saved === null || Array.isArray(saved)) return {};
  return Object.fromEntries(
    Object.entries(saved).flatMap(([workspaceKey, choices]) =>
      typeof choices === "object" && choices !== null && !Array.isArray(choices)
        ? [
            [
              workspaceKey,
              Object.fromEntries(
                Object.entries(choices).filter(
                  (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
                ),
              ),
            ] as const,
          ]
        : [],
    ),
  );
}

export function tabFor(tabs: Readonly<Record<string, FrameTab>>, workspaceKey: string): FrameTab {
  return tabs[workspaceKey] ?? "jam";
}

interface FrameStore {
  /** The last-used tab per workspace key. */
  readonly tabs: Readonly<Record<string, FrameTab>>;
  /** Milestones the user opened or closed, per workspace key; unset ones follow their default. */
  readonly milestoneOpen: OpenMap;
  /** Per workspace: the plan text last seen and when it last changed under us (null: first read). Not persisted. */
  readonly planSeen: Readonly<
    Record<string, { readonly contents: string; readonly changedAt: number | null }>
  >;
  /** A needs-you card asked for this thread's pending question to open; `at` lets it expire. */
  readonly answerRequest: { readonly key: string; readonly at: number } | null;
  /** A feed line asked for Kit to open on Updates; the Kit frame takes it once. Not persisted. */
  readonly kitUpdatesRequested: boolean;
  setKitUpdatesRequested: (requested: boolean) => void;
  setTab: (workspaceKey: string, tab: FrameTab) => void;
  setMilestoneOpen: (workspaceKey: string, milestoneKey: string, open: boolean) => void;
  notePlan: (workspaceKey: string, contents: string) => void;
  requestAnswer: (threadKey: string) => void;
  setAnswerRequest: (request: { readonly key: string; readonly at: number } | null) => void;
}

/** Per-device, client-only; never sent to the server. */
export const useFrameStore = create<FrameStore>()(
  persist(
    (set) => ({
      tabs: {},
      milestoneOpen: {},
      planSeen: {},
      answerRequest: null,
      kitUpdatesRequested: false,
      setKitUpdatesRequested: (kitUpdatesRequested) => set({ kitUpdatesRequested }),
      setTab: (workspaceKey, tab) =>
        set((state) => ({ tabs: { ...state.tabs, [workspaceKey]: tab } })),
      setMilestoneOpen: (workspaceKey, milestoneKey, open) =>
        set((state) => ({
          milestoneOpen: {
            ...state.milestoneOpen,
            [workspaceKey]: { ...state.milestoneOpen[workspaceKey], [milestoneKey]: open },
          },
        })),
      notePlan: (workspaceKey, contents) =>
        set((state) => {
          const before = state.planSeen[workspaceKey];
          if (before?.contents === contents) return state;
          return {
            planSeen: {
              ...state.planSeen,
              [workspaceKey]: { contents, changedAt: before === undefined ? null : Date.now() },
            },
          };
        }),
      requestAnswer: (key) => set({ answerRequest: { key, at: Date.now() } }),
      setAnswerRequest: (answerRequest) => set({ answerRequest }),
    }),
    {
      name: FRAME_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({
        ...current,
        tabs: sanitizeFrameTabs(persisted),
        milestoneOpen: sanitizeMilestoneOpen(persisted),
      }),
      partialize: ({ tabs, milestoneOpen }) => ({ tabs, milestoneOpen }),
    },
  ),
);
