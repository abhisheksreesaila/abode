import { FolderIcon, FolderOpenIcon, MessagesSquareIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { workspacePillView, type WorkspacePill, type WorkspacePillKind } from "./workspaceList";

const COUNT_PILL_TONE = {
  "needs-you": "bg-warning/15 text-warning-foreground",
  running: "bg-muted text-sidebar-foreground",
  done: "bg-success/15 text-success-foreground",
} as const satisfies Record<Exclude<WorkspacePillKind, "failed">, string>;

/**
 * The inside of a workspace row (abode F-035, like the reference): a folder icon
 * tinted with the workspace color, the name, and on the right a count pill or a red
 * "failed". The folder opens while expanded; the no-project folder reads "Chats"
 * with a chat icon. The pill stays visible while collapsed.
 */
export const WorkspaceHeaderContent = memo(function WorkspaceHeaderContent(props: {
  readonly name: string;
  /** The no-project folder. */
  readonly chats?: boolean;
  readonly color: string | null;
  readonly expanded: boolean;
  readonly pill: WorkspacePill | null;
  readonly groupedProjectCount: number;
}) {
  const { name, chats = false, color, expanded, pill, groupedProjectCount } = props;
  const Icon = chats ? MessagesSquareIcon : expanded ? FolderOpenIcon : FolderIcon;
  const pillView = pill ? workspacePillView(pill) : null;
  return (
    <>
      <Icon
        aria-hidden
        className="size-3.5 shrink-0 text-sidebar-muted-foreground"
        style={color && !chats ? { color } : undefined}
      />
      <span className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
        <span className="min-w-0 truncate text-xs font-semibold text-sidebar-foreground">
          {chats ? "Chats" : name}
        </span>
        {groupedProjectCount > 1 ? (
          <span className="shrink-0 text-secondary-label text-3xs">
            {groupedProjectCount} projects
          </span>
        ) : null}
      </span>
      {pill && pillView ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                data-testid="workspace-status-pill"
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center text-3xs font-bold",
                  pillView.kind === "failed"
                    ? "gap-0.5 text-destructive"
                    : cn("rounded-full px-1.5", COUNT_PILL_TONE[pillView.tone]),
                )}
              />
            }
          >
            {pillView.text}
          </TooltipTrigger>
          <TooltipPopup side="top">{pill.detail}</TooltipPopup>
        </Tooltip>
      ) : null}
      {/* Keeps the pill clear of the new-thread button overlaid on the row's end (it stays
          visible on touch). */}
      <span aria-hidden className="w-4 shrink-0 max-sm:w-8" />
    </>
  );
});
