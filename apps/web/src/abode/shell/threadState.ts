import {
  resolveSidebarThreadStatus,
  resolveThreadLastVisitedAt,
  resolveThreadStatusPill,
} from "../../components/Sidebar.logic";
import type { SidebarThreadSummary } from "../../types";
import type { WorkspaceThreadState } from "./workspaceList";

/**
 * Collapses upstream's status resolvers into what the abode sidebar draws.
 * The typed thread status decides needs-you, running and failed; the status
 * pill is only consulted for what it alone knows: a plan waiting for approval
 * and a finished run the user has not visited yet. `localLastVisitedAt` is the
 * browser-side visit time, used when the server does not track visits.
 */
export function deriveWorkspaceThreadState(
  thread: SidebarThreadSummary,
  localLastVisitedAt: string | undefined,
): WorkspaceThreadState {
  const status = resolveSidebarThreadStatus(thread);
  const failed = status === "failed" || status === "limited";
  if (status === "approval" || status === "input") return { attention: "needs-you", failed };
  if (status === "working") return { attention: "running", failed };
  const lastVisitedAt = resolveThreadLastVisitedAt(thread.lastVisitedAt, localLastVisitedAt);
  const pill = resolveThreadStatusPill({
    thread: { ...thread, ...(lastVisitedAt !== undefined ? { lastVisitedAt } : {}) },
  });
  if (pill?.label === "Plan Ready") return { attention: "needs-you", failed };
  if (pill?.label === "Completed") return { attention: "done", failed };
  return { attention: null, failed };
}
