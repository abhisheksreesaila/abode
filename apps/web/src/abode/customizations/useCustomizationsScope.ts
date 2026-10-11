import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { useProject, useThreadShell } from "~/state/entities";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "~/threadRoutes";

export interface CustomizationsScope {
  readonly environmentId: EnvironmentId;
  /** The registered project root; customizations belong to the workspace, not a checkout copy. */
  readonly cwd: string;
  readonly projectName: string;
  /** Null when there is no thread whose side panel could open a file. */
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
  const threadRef = resolveActiveThreadRouteRef(routeTarget, routeDraft);
  const shell = useThreadShell(threadRef);
  const source = shell ?? routeDraft;
  const projectRef = useMemo(
    () => (source ? scopeProjectRef(source.environmentId, source.projectId) : null),
    [source],
  );
  const project = useProject(projectRef);
  if (!source || !project?.workspaceRoot) return null;
  return {
    environmentId: source.environmentId,
    cwd: project.workspaceRoot,
    projectName: project.title,
    threadRef,
  };
}
