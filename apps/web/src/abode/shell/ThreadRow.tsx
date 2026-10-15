import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { threadRuntimeCanArchive } from "@t3tools/client-runtime/state/models";
import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import { resolveThreadCurrentPullRequestLink } from "@t3tools/shared/threadPullRequests";
import { ArchiveIcon, FolderIcon } from "lucide-react";
import { memo, useCallback, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import {
  ChangeRequestStatusIcon,
  prStatusIndicator,
  PrStatusTooltipContent,
  ThreadWorktreeIndicator,
  useLinkedThreadPullRequest,
} from "~/components/ThreadStatusIndicators";
import { useSidebarRowSubscriptionLease } from "~/components/Sidebar.logic";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { useSupportsMultiplePullRequests } from "~/hooks/useSupportsMultiplePullRequests";
import { useNowMinute } from "~/hooks/useNowMinute";
import { useOpenPrLink } from "~/lib/openPullRequestLink";
import { cn } from "~/lib/utils";
import { useEnvironmentScope } from "~/state/session";
import { formatRelativeTime } from "~/timestampFormat";
import type { SidebarThreadSummary } from "~/types";
import { useUiStateStore } from "~/uiStateStore";
import { useAbodeSidebar } from "./sidebarContext";
import { SubagentRows } from "./SubagentRows";
import { deriveWorkspaceThreadState } from "./threadState";
import {
  sessionPlace,
  threadMetaLabel,
  threadSquareTone,
  type ThreadSquareTone,
} from "./workspaceList";

const TONE_META_CLASS: Record<ThreadSquareTone, string> = {
  running: "text-sidebar-muted-foreground",
  "needs-you": "",
  failed: "text-error-foreground",
  done: "text-sidebar-muted-foreground",
  idle: "text-sidebar-muted-foreground",
};

/** The 7px status square: green running, orange needs you, red failed, dim idle. */
export function StatusSquare({ tone }: { tone: ThreadSquareTone }) {
  return <span aria-hidden data-tone={tone} data-abode="square" />;
}

interface ThreadRowProps {
  readonly thread: SidebarThreadSummary;
  readonly workspaceKey: string;
  readonly workspaceRoot: string | null;
  readonly isActive: boolean;
  readonly runningSubagents: ReadonlyArray<SidebarThreadSummary>;
}

/**
 * One session, two lines like VS Code's agent sessions: a status square and the title, then
 * where it runs (worktree or workspace folder, and the branch) and its age. The
 * shared behaviours (PR state, inline rename, archive, the context menu) call
 * the same upstream hooks and commands the other sidebars use.
 */
export const ThreadRow = memo(function ThreadRow(props: ThreadRowProps) {
  const { thread, workspaceKey, workspaceRoot, isActive, runningSubagents } = props;
  const { actions, navigateToThread } = useAbodeSidebar();
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const threadKey = scopedThreadKey(threadRef);
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const localLastVisitedAt = useUiStateStore((state) => state.threadLastVisitedAtById[threadKey]);
  const { leaseLiveStatus, rowRef } = useSidebarRowSubscriptionLease(isActive);
  const openPrLink = useOpenPrLink();

  const state = deriveWorkspaceThreadState(thread, localLastVisitedAt);
  const tone = threadSquareTone(state.attention, state.failed);
  // Re-render each minute: the row is memoised, so the age would otherwise freeze.
  useNowMinute();
  const age = formatRelativeTime(
    thread.latestUserMessageAt ?? thread.updatedAt ?? thread.createdAt,
  );
  const place = sessionPlace(thread);
  const meta = threadMetaLabel(tone, age ? (age.suffix ? age.value : "now") : "");

  const linkedPullRequest = useLinkedThreadPullRequest(
    thread.environmentId,
    thread.linkedPullRequest,
    leaseLiveStatus,
    thread.pullRequests,
    thread.branchPullRequest,
  );
  const pr = linkedPullRequest?.pr ?? null;
  const supportsMultiplePullRequests = useSupportsMultiplePullRequests(thread.environmentId);
  const currentLink = supportsMultiplePullRequests
    ? resolveThreadCurrentPullRequestLink(thread.pullRequests)
    : null;
  const prStatus = prStatusIndicator(pr, linkedPullRequest?.sourceControlProvider);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(thread.title);
  // Enter and Escape finish the edit themselves; the blur that follows must not commit twice.
  const renameSettledRef = useRef(false);
  const startRename = useCallback(() => {
    setRenameValue(thread.title);
    renameSettledRef.current = false;
    setRenaming(true);
  }, [thread.title]);
  const finishRename = useCallback(
    (commit: boolean) => {
      if (renameSettledRef.current) return;
      renameSettledRef.current = true;
      setRenaming(false);
      if (commit) void actions.renameThread(threadRef, renameValue, thread.title);
    },
    [actions, renameValue, thread.title, threadRef],
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      // A double-click starts a rename; its second click must not navigate again.
      if (event.detail > 1) return;
      if ((event.target as HTMLElement).closest("a, button, input")) return;
      navigateToThread(threadRef);
    },
    [navigateToThread, threadRef],
  );
  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      if (!canOperate || (event.target as HTMLElement).closest("a, button, input")) return;
      event.preventDefault();
      startRename();
    },
    [canOperate, startRename],
  );
  const openMenu = useCallback(
    (position: { x: number; y: number }) => {
      void actions.showThreadMenu({ thread, workspaceKey, workspaceRoot, position, startRename });
    },
    [actions, startRename, thread, workspaceKey, workspaceRoot],
  );
  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      openMenu({ x: event.clientX, y: event.clientY });
    },
    [openMenu],
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, button, a")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigateToThread(threadRef);
      } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        openMenu({ x: rect.left, y: rect.bottom });
      }
    },
    [navigateToThread, openMenu, threadRef],
  );
  const handlePrClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const url = prStatus?.url ?? currentLink?.url;
      if (url) openPrLink(event, url, isActive ? threadRef : undefined);
    },
    [currentLink, isActive, openPrLink, prStatus, threadRef],
  );

  const canArchive = canOperate && threadRuntimeCanArchive(thread.runtime);

  return (
    <li ref={rowRef} className="list-none">
      <div
        role="button"
        tabIndex={0}
        aria-current={isActive ? "page" : undefined}
        data-testid={`thread-row-${thread.id}`}
        data-active={isActive}
        data-abode="row thread"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        <StatusSquare tone={tone} />
        <span data-abode="lines">
          <span data-abode="line">
            {renaming ? (
              <input
                // Autofocus on mount is the inline-rename contract: the row swaps into an editor.
                ref={(element) => {
                  if (element && document.activeElement !== element) {
                    element.focus();
                    element.select();
                  }
                }}
                aria-label="Thread title"
                className="min-w-0 flex-1 rounded-xs border border-ring bg-transparent px-1 text-sidebar-foreground outline-none"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onBlur={() => finishRename(true)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    finishRename(true);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    finishRename(false);
                  }
                }}
              />
            ) : (
              <span
                className={cn("min-w-0 flex-1 truncate", isActive && "font-medium")}
                data-testid={`thread-title-${thread.id}`}
              >
                {thread.title}
              </span>
            )}
            {prStatus && pr ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <a
                      href={prStatus.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={prStatus.tooltip}
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center rounded-sm outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                        prStatus.colorClass,
                      )}
                      onClick={handlePrClick}
                    />
                  }
                >
                  <ChangeRequestStatusIcon
                    state={pr.state}
                    isDraft={pr.isDraft}
                    className="size-3"
                  />
                </TooltipTrigger>
                <TooltipPopup side="top">
                  <PrStatusTooltipContent status={prStatus} />
                </TooltipPopup>
              </Tooltip>
            ) : currentLink ? (
              <a
                href={currentLink.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`PR #${currentLink.number}, status pending`}
                className="inline-flex shrink-0 items-center text-muted-foreground"
                onClick={handlePrClick}
              >
                <PullRequestGlyph.pullRequest className="size-3" />
              </a>
            ) : null}
          </span>
          <span data-abode="line place">
            {place.kind === "worktree" ? (
              <ThreadWorktreeIndicator thread={thread} />
            ) : (
              <FolderIcon aria-hidden className="size-3 shrink-0" />
            )}
            {place.branch ? <span className="min-w-0 truncate">{place.branch}</span> : null}
            <span aria-hidden>·</span>
            <span
              data-abode={canArchive ? "meta yields" : "meta"}
              data-tone={tone}
              className={TONE_META_CLASS[tone]}
            >
              {meta}
            </span>
          </span>
        </span>
        {canArchive ? (
          <button
            type="button"
            aria-label={`Archive ${thread.title}`}
            data-testid={`thread-archive-${thread.id}`}
            data-abode="action"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void actions.archiveWithConfirm(threadRef, thread.title);
            }}
          >
            <ArchiveIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
      <SubagentRows subagents={runningSubagents} />
    </li>
  );
});
