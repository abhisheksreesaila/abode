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

export function tabFor(tabs: Readonly<Record<string, FrameTab>>, workspaceKey: string): FrameTab {
  return tabs[workspaceKey] ?? "jam";
}

interface FrameStore {
  /** The last-used tab per workspace key. */
  readonly tabs: Readonly<Record<string, FrameTab>>;
  /** A needs-you card asked for this thread's pending question to open; `at` lets it expire. */
  readonly answerRequest: { readonly key: string; readonly at: number } | null;
  setTab: (workspaceKey: string, tab: FrameTab) => void;
  requestAnswer: (threadKey: string) => void;
  setAnswerRequest: (request: { readonly key: string; readonly at: number } | null) => void;
}

/** Per-device, client-only; never sent to the server. */
export const useFrameStore = create<FrameStore>()(
  persist(
    (set) => ({
      tabs: {},
      answerRequest: null,
      setTab: (workspaceKey, tab) =>
        set((state) => ({ tabs: { ...state.tabs, [workspaceKey]: tab } })),
      requestAnswer: (key) => set({ answerRequest: { key, at: Date.now() } }),
      setAnswerRequest: (answerRequest) => set({ answerRequest }),
    }),
    {
      name: FRAME_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      merge: (persisted, current) => ({ ...current, tabs: sanitizeFrameTabs(persisted) }),
      partialize: ({ tabs }) => ({ tabs }),
    },
  ),
);
