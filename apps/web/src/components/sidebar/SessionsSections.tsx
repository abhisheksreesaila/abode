import {
  scopedProjectKey,
  scopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { CalendarClockIcon, PinIcon } from "lucide-react";
import { memo, useMemo, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { useProjects } from "../../state/entities";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import type { SidebarThreadSummary } from "../../types";
import { resolveThreadStatusPill } from "../Sidebar.logic";
import { ThreadStatusSquare } from "./FluentSidebarParts";
import { SessionMetaLine } from "./SessionMetaLine";
import { useSessionDiffStore } from "./sessionDiffStore";
import { formatSessionMeta, groupSessionSections } from "./sessionsSections";
import { showRegisteredThreadContextMenu } from "./threadContextMenuRegistry";

/** Icon and label, the look of the reference's Automations and Pinned headers. */
function SectionHeader({ icon, label }: { readonly icon: ReactNode; readonly label: string }) {
  return (
    <div className="flex h-7 items-center gap-2 px-2 text-xs font-semibold text-sidebar-foreground [&>svg]:size-3.5 [&>svg]:text-sidebar-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

const SessionRow = memo(function SessionRow(props: {
  readonly thread: SidebarThreadSummary;
  readonly projectName: string;
  readonly isActive: boolean;
  readonly onOpen: (threadRef: ScopedThreadRef) => void;
}) {
  const { thread, projectName, isActive, onOpen } = props;
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const diff = useSessionDiffStore(
    (state) => state.byThreadKey[scopedThreadKey(threadRef)] ?? null,
  );
  const status = resolveThreadStatusPill({ thread });
  const meta = formatSessionMeta({
    diff,
    projectName,
    relativeTime: formatRelativeTimeLabel(
      thread.latestUserMessageAt ?? thread.updatedAt ?? thread.createdAt,
    ),
  });
  return (
    <button
      type="button"
      data-testid={`session-row-${thread.id}`}
      data-active={isActive}
      onClick={() => onOpen(threadRef)}
      onContextMenu={(event) => {
        event.preventDefault();
        void showRegisteredThreadContextMenu(
          scopedProjectKey(scopeProjectRef(thread.environmentId, thread.projectId)),
          threadRef,
          { x: event.clientX, y: event.clientY },
        );
      }}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-xs px-2 py-1 text-left outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        isActive
          ? "bg-sidebar-row-active font-medium text-white ring-1 ring-inset ring-primary"
          : "text-sidebar-muted-foreground/80 hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
      )}
    >
      <span className="mt-[5px]">
        <ThreadStatusSquare statusLabel={status?.label ?? null} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{thread.title}</span>
        <SessionMetaLine {...meta} />
      </span>
    </button>
  );
});

/**
 * Automations (autonomous threads) and Pinned, above the project folders. Each is
 * hidden when empty. Rows open the thread; the full row menus live in the folders.
 */
export const SessionsSections = memo(function SessionsSections(props: {
  readonly threads: readonly SidebarThreadSummary[];
  readonly activeThreadKey: string | null;
  readonly onOpenThread: (threadRef: ScopedThreadRef) => void;
}) {
  const { threads, activeThreadKey, onOpenThread } = props;
  const projects = useProjects();
  const projectNameByKey = useMemo(
    () =>
      new Map(
        projects.map(
          (project) =>
            [
              scopedProjectKey(scopeProjectRef(project.environmentId, project.id)),
              project.title,
            ] as const,
        ),
      ),
    [projects],
  );
  const sections = useMemo(() => groupSessionSections(threads), [threads]);
  const render = (list: readonly SidebarThreadSummary[]) =>
    list.map((thread) => {
      const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
      return (
        <SessionRow
          key={threadKey}
          thread={thread}
          projectName={
            projectNameByKey.get(
              scopedProjectKey(scopeProjectRef(thread.environmentId, thread.projectId)),
            ) ?? ""
          }
          isActive={activeThreadKey === threadKey}
          onOpen={onOpenThread}
        />
      );
    });
  return (
    <>
      {sections.automations.length > 0 ? (
        <section aria-label="Automations" className="flex flex-col pb-1">
          <SectionHeader icon={<CalendarClockIcon />} label="Automations" />
          {render(sections.automations)}
        </section>
      ) : null}
      {sections.pinned.length > 0 ? (
        <section aria-label="Pinned" className="flex flex-col pb-1">
          <SectionHeader icon={<PinIcon />} label="Pinned" />
          {render(sections.pinned)}
        </section>
      ) : null}
    </>
  );
});
