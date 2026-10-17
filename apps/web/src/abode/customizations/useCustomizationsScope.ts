import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { useParams } from "@tanstack/react-router";

import { useComposerDraftStore } from "~/composerDraftStore";
import { useProject, useThreadShell } from "~/state/entities";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "~/threadRoutes";

export interface CustomizationsScope {
  readonly environmentId: EnvironmentId;
  /** The registered project root; customizations belong to the workspace, not a checkout copy. */
  readonly cwd: string;
  readonly projectName: string;
  /** The side panel to open files in: the thread's, or a new-thread draft's own. */
  readonly threadRef: ScopedThreadRef | null;
}

/** The active session's workspace. Null until a session or draft is open. */
export function useActiveCustomizationsScope(): CustomizationsScope | null {
  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const routeDraft = useComposerDraftStore((store) =>
    routeTarget?.kind === "draft" ? store.getDraftSession(routeTarget.draftId) : null,
  );
  const serverThreadRef = resolveActiveThreadRouteRef(routeTarget, routeDraft);
  const shell = useThreadShell(serverThreadRef);
  // A draft has no server thread yet, but ChatView already keys its side panel by the draft's id.
  const draftThreadRef = routeDraft
    ? scopeThreadRef(routeDraft.environmentId, routeDraft.threadId)
    : null;
  const threadRef = serverThreadRef ?? draftThreadRef;
  const source = shell ?? routeDraft;
  const projectRef = source ? scopeProjectRef(source.environmentId, source.projectId) : null;
  const project = useProject(projectRef);
  if (!source || !project?.workspaceRoot) return null;
  return {
    environmentId: source.environmentId,
    cwd: project.workspaceRoot,
    projectName: project.title,
    threadRef,
  };
}
