import {
  resolveSidebarThreadStatus,
  resolveThreadLastVisitedAt,
  resolveThreadStatusPill,
} from "../../components/Sidebar.logic";
import type { SidebarThreadSummary } from "../../types";
import type { WorkspaceThreadState } from "./workspaceList";

/**
 * Collapses upstream's two status resolvers into what the abode sidebar draws:
 * the pill label (which also tells needs-you from running) and whether the last
 * run failed. `localLastVisitedAt` is the browser-side visit time, used when
 * the server does not track visits.
 */
export function deriveWorkspaceThreadState(
  thread: SidebarThreadSummary,
  localLastVisitedAt: string | undefined,
): WorkspaceThreadState {
  const lastVisitedAt = resolveThreadLastVisitedAt(thread.lastVisitedAt, localLastVisitedAt);
  const pill = resolveThreadStatusPill({
    thread: { ...thread, ...(lastVisitedAt !== undefined ? { lastVisitedAt } : {}) },
  });
  const status = resolveSidebarThreadStatus(thread);
  return {
    statusLabel: pill?.label ?? null,
    failed: status === "failed" || status === "limited",
  };
}
