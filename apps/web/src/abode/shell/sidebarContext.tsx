import type { ScopedThreadRef } from "@t3tools/contracts";
import { createContext, use } from "react";

import type { useAbodeThreadActions } from "./useAbodeThreadActions";

/**
 * What every row of the abode sidebar needs from the sidebar itself. Passing it
 * through context keeps the command hooks (archive, rename, copy, ...) mounted
 * once instead of once per row. Everything in here is stable across renders,
 * so a row's memo is only broken by its own props.
 */
export interface AbodeSidebarContextValue {
  readonly actions: ReturnType<typeof useAbodeThreadActions>;
  readonly navigateToThread: (threadRef: ScopedThreadRef) => void;
  readonly navigateToDraft: (draftId: string) => void;
}

export const AbodeSidebarContext = createContext<AbodeSidebarContextValue | null>(null);

export function useAbodeSidebar(): AbodeSidebarContextValue {
  const value = use(AbodeSidebarContext);
  if (value === null) throw new Error("useAbodeSidebar must be used inside AbodeSidebar.");
  return value;
}

/** Which session or draft is open. Kept apart because it changes on every navigation. */
export interface AbodeActiveRoute {
  /** `environmentId:threadId` of the open session, or null. */
  readonly threadKey: string | null;
  readonly draftId: string | null;
}

export const AbodeActiveRouteContext = createContext<AbodeActiveRoute>({
  threadKey: null,
  draftId: null,
});

export function useAbodeActiveRoute(): AbodeActiveRoute {
  return use(AbodeActiveRouteContext);
}
