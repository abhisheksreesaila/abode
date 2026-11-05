import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { presentThreadShell } from "@t3tools/client-runtime/state/shell";
import { ArchiveRestoreIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useThreadActions } from "~/hooks/useThreadActions";
import { useArchivedThreadSnapshots } from "~/lib/archivedThreadsState";
import { useEnvironments } from "~/state/environments";

import { archivedItems, type ArchivedItem } from "./archivedRail";
import { useRemovedWorkspacesStore } from "./workspaceRemovedStore";

function ArchivedRow(props: { readonly item: ArchivedItem; readonly onRestore: () => void }) {
  const { item, onRestore } = props;
  const label =
    item.kind === "workspace" ? `Restore workspace ${item.name}` : `Restore ${item.name}`;
  return (
    <li className="list-none">
      <div data-abode="row thread" data-testid={`archived-${item.kind}-${item.key}`}>
        <span className="min-w-0 flex-1 truncate">
          {item.name}
          {item.kind === "thread" ? (
            <span data-abode="meta"> · {item.workspace}</span>
          ) : (
            <span data-abode="meta"> · workspace</span>
          )}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={label}
                data-abode="inline-action"
                onClick={onRestore}
              />
            }
          >
            <ArchiveRestoreIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="right">{label}</TooltipPopup>
        </Tooltip>
      </div>
    </li>
  );
}

/** Mounted only while the section is open, so a closed rail asks no server for archived threads. */
function ArchivedList(props: {
  readonly hiddenWorkspaces: ReadonlyArray<{ readonly key: string; readonly name: string }>;
}) {
  const { environments } = useEnvironments();
  const { unarchiveThread } = useThreadActions();
  const { snapshots, isLoading } = useArchivedThreadSnapshots(
    environments.map((environment) => environment.environmentId),
  );
  const threads = snapshots.flatMap(({ environmentId, snapshot }) => {
    const titles = new Map(snapshot.projects.map((project) => [project.id, project.title]));
    return snapshot.threads.map((raw) => {
      const thread = presentThreadShell(environmentId, raw);
      return {
        environmentId,
        id: thread.id,
        title: thread.title,
        projectTitle: titles.get(thread.projectId) ?? "",
        archivedAt: thread.archivedAt,
        createdAt: thread.createdAt,
        isSubagent: thread.lineage.relationshipToParent === "subagent",
      };
    });
  });
  const items = archivedItems({
    hiddenWorkspaces: props.hiddenWorkspaces,
    archivedThreads: threads,
  });

  const restore = async (item: ArchivedItem) => {
    if (item.kind === "workspace") {
      useRemovedWorkspacesStore.getState().setRemoved(item.key, false);
      return;
    }
    const result = await unarchiveThread(
      scopeThreadRef(EnvironmentId.make(item.environmentId), ThreadId.make(item.threadId)),
    );
    if (result._tag === "Failure") {
      toastManager.add(stackedThreadToast({ type: "error", title: "Failed to restore thread" }));
    }
  };

  if (items.length === 0) {
    return (
      <p data-abode="meta" className="px-3 py-1" data-testid="archived-empty">
        {isLoading ? "Loading…" : "Nothing archived"}
      </p>
    );
  }
  return (
    <ul data-abode="guide">
      {items.map((item) => (
        <ArchivedRow
          key={`${item.kind}:${item.key}`}
          item={item}
          onRestore={() => void restore(item)}
        />
      ))}
    </ul>
  );
}

/** The rail's "Archived" section: hidden workspaces and archived threads, each with a restore button. */
export function ArchivedSection(props: {
  readonly hiddenWorkspaces: ReadonlyArray<{ readonly key: string; readonly name: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Archived" data-testid="archived-section">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        data-abode="row workspace-header"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <ChevronRightIcon aria-hidden className={`size-4 shrink-0 ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1 truncate">Archived</span>
        {props.hiddenWorkspaces.length > 0 ? (
          <span data-abode="meta">{props.hiddenWorkspaces.length}</span>
        ) : null}
      </div>
      {open ? <ArchivedList hiddenWorkspaces={props.hiddenWorkspaces} /> : null}
    </section>
  );
}
