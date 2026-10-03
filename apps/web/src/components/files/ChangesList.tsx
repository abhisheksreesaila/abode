import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { useMemo } from "react";

import { useDiffPanelStore } from "~/diffPanelStore";
import { useRightPanelStore } from "~/rightPanelStore";
import { useProjects } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { vcsEnvironment } from "~/state/vcs";

import { changesPanelState, type ChangedFileRow } from "./changesList";

/**
 * The drawer's Changes tab (abode F-040): files changed in the workspace's
 * working tree, from the VCS status the git controls already subscribe to (no
 * extra polling), filling the drawer's height. Empty state when nothing changed.
 */
export function ChangesList(props: {
  environmentId: EnvironmentId;
  cwd: string;
  /** Needed to open the diff of a deleted file. */
  threadRef?: ScopedThreadRef | null | undefined;
  onOpenFile: (relativePath: string) => void;
}) {
  const { data: status, error } = useEnvironmentQuery(
    props.cwd
      ? vcsEnvironment.status({ environmentId: props.environmentId, input: { cwd: props.cwd } })
      : null,
  );
  const projects = useProjects();
  // Status paths are repo-root relative; a project below the repo root needs its root to trim them.
  const repositoryRoot = useMemo(
    () =>
      projects.find(
        (project) =>
          project.environmentId === props.environmentId && project.workspaceRoot === props.cwd,
      )?.repositoryIdentity?.rootPath,
    [projects, props.cwd, props.environmentId],
  );
  const state = useMemo(
    () => changesPanelState(status, error, { workspaceRoot: props.cwd, repositoryRoot }),
    [status, error, props.cwd, repositoryRoot],
  );
  const { threadRef, onOpenFile } = props;
  const openRow = (row: ChangedFileRow) => {
    if (row.kind === "folder") return;
    if (row.kind === "deleted") {
      if (!threadRef) return;
      useDiffPanelStore.getState().selectGitScope(threadRef, "unstaged");
      useRightPanelStore.getState().open(threadRef, "diff");
      return;
    }
    onOpenFile(row.path);
  };
  if (state.kind !== "changes") {
    return (
      <ChangesMessage
        tone={state.kind === "error" ? "error" : "quiet"}
        text={
          state.kind === "loading"
            ? "Checking for changes…"
            : state.kind === "error"
              ? `Could not read changes: ${state.message}`
              : state.kind === "not-repo"
                ? "Not a git repository"
                : "No changes"
        }
      />
    );
  }
  const { summary } = state;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-changes-list>
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border/60 px-3 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Changed files</span>
        <span className="rounded-full bg-muted px-1.5 text-2xs font-bold normal-case">
          {summary.rows.length}
        </span>
        <span className="ml-auto font-mono text-2xs normal-case">
          <span className="text-success">+{summary.insertions}</span>{" "}
          <span className="text-destructive">-{summary.deletions}</span>
        </span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {summary.rows.map((row) => (
          <li key={row.path}>
            <button
              type="button"
              disabled={row.kind === "folder"}
              onClick={() => openRow(row)}
              className="flex h-[22px] w-full items-center gap-2 px-3 text-left text-xs enabled:hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-default"
            >
              <span className="min-w-0 truncate">
                <span
                  className={
                    row.kind === "deleted"
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }
                >
                  {row.name}
                  {row.kind === "folder" ? "/" : ""}
                </span>
                {row.directory ? (
                  <span className="ml-1.5 text-2xs text-muted-foreground">{row.directory}</span>
                ) : null}
              </span>
              {row.kind === "file" ? (
                <span className="ml-auto shrink-0 font-mono text-2xs">
                  <span className="text-success">+{row.insertions}</span>{" "}
                  <span className="text-destructive">-{row.deletions}</span>
                </span>
              ) : (
                <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
                  {row.kind === "folder" ? "new folder" : "deleted"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Changes tab's one-line states: loading, error, not a repository, no changes. */
export function ChangesMessage(props: { text: string; tone?: "quiet" | "error" }) {
  return (
    <div
      className={`flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm ${
        props.tone === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
      data-changes-list
    >
      {props.text}
    </div>
  );
}
