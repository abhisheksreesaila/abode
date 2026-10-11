import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

/**
 * Pure grouping for the abode sidebar. Upstream already builds the project
 * groups (`buildSidebarProjectSnapshots`) and sorts them; this only decides
 * which threads and drafts belong under which workspace.
 */

export interface ProjectRefLike {
  readonly environmentId: string;
  readonly projectId: string;
}

export function projectRefKey(ref: ProjectRefLike): string {
  return `${ref.environmentId}:${ref.projectId}`;
}

/** Upstream's scoped key for a thread shell: what routes, selection and visit tracking use. */
export function threadShellKey(thread: { environmentId: EnvironmentId; id: ThreadId }): string {
  return scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
}

export function groupThreadsByWorkspace<TThread extends ProjectRefLike>(
  groups: ReadonlyArray<{
    readonly projectKey: string;
    readonly memberProjectRefs: ReadonlyArray<ProjectRefLike>;
  }>,
  threads: ReadonlyArray<TThread>,
): Map<string, TThread[]> {
  const workspaceKeyByProjectRef = new Map<string, string>();
  for (const group of groups) {
    for (const ref of group.memberProjectRefs) {
      workspaceKeyByProjectRef.set(projectRefKey(ref), group.projectKey);
    }
  }
  const byWorkspace = new Map<string, TThread[]>();
  for (const thread of threads) {
    const workspaceKey = workspaceKeyByProjectRef.get(projectRefKey(thread));
    if (workspaceKey === undefined) continue;
    const existing = byWorkspace.get(workspaceKey);
    if (existing) existing.push(thread);
    else byWorkspace.set(workspaceKey, [thread]);
  }
  return byWorkspace;
}

/** The scratch project backs "new thread without a project"; it has no folder to name. */
export function workspaceDisplayName(input: {
  readonly displayName: string;
  readonly isScratch: boolean;
}): string {
  return input.isScratch ? "Chats" : input.displayName;
}

export interface DraftRowSource<TSession, TComposer> {
  readonly draftId: string;
  readonly session: TSession;
  readonly composer: TComposer;
}

/**
 * Unsent drafts worth a row: not yet sent, with something typed. The draft that
 * is open right now is left out. Its row would repaint on every keystroke, and
 * the composer already shows it.
 */
export function visibleDraftRows<
  TSession extends { readonly createdAt: string; readonly promotedTo?: unknown },
  TComposer,
>(input: {
  readonly sessions: Readonly<Record<string, TSession>>;
  readonly composers: Readonly<Record<string, TComposer | undefined>>;
  readonly routeDraftId: string | null;
  readonly hasContent: (composer: TComposer) => boolean;
}): Array<DraftRowSource<TSession, TComposer>> {
  const rows: Array<DraftRowSource<TSession, TComposer>> = [];
  for (const [draftId, session] of Object.entries(input.sessions)) {
    if (session.promotedTo != null || draftId === input.routeDraftId) continue;
    const composer = input.composers[draftId];
    if (composer === undefined || !input.hasContent(composer)) continue;
    rows.push({ draftId, session, composer });
  }
  rows.sort((left, right) => right.session.createdAt.localeCompare(left.session.createdAt));
  return rows;
}

/** Draft ids per workspace key, computed once for the whole sidebar. */
export function draftIdsByWorkspace<
  TSession extends ProjectRefLike & { readonly createdAt: string; readonly promotedTo?: unknown },
  TComposer,
>(input: {
  readonly groups: ReadonlyArray<{
    readonly projectKey: string;
    readonly memberProjectRefs: ReadonlyArray<ProjectRefLike>;
  }>;
  readonly sessions: Readonly<Record<string, TSession>>;
  readonly composers: Readonly<Record<string, TComposer | undefined>>;
  readonly routeDraftId: string | null;
  readonly hasContent: (composer: TComposer) => boolean;
}): Record<string, string[]> {
  const rows = visibleDraftRows(input);
  const grouped = groupThreadsByWorkspace(
    input.groups,
    rows.map((row) => ({ ...row.session, draftId: row.draftId })),
  );
  const result: Record<string, string[]> = {};
  for (const [workspaceKey, drafts] of grouped) result[workspaceKey] = drafts.map((d) => d.draftId);
  return result;
}
