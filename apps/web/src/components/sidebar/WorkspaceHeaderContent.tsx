import { ChevronRightIcon } from "lucide-react";
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
 * The inside of a workspace row (abode F-028, Fluent): one line with a chevron,
 * an 8px square color dot, the name, a dim location, and on the right a count
 * pill or a red "failed". The pill stays visible while the workspace is collapsed.
 */
export const WorkspaceHeaderContent = memo(function WorkspaceHeaderContent(props: {
  readonly name: string;
  readonly location: string;
  readonly color: string | null;
  readonly expanded: boolean;
  readonly pill: WorkspacePill | null;
  readonly groupedProjectCount: number;
}) {
  const { name, location, color, expanded, pill, groupedProjectCount } = props;
  const pillView = pill ? workspacePillView(pill) : null;
  return (
    <>
      <ChevronRightIcon
        className={cn(
          "size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150",
          expanded && "rotate-90",
        )}
      />
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-xs bg-muted"
        style={color ? { backgroundColor: color } : undefined}
      />
      <span className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
        <span className="shrink-0 truncate text-xs font-semibold text-sidebar-foreground">
          {name}
        </span>
        {groupedProjectCount > 1 ? (
          <span className="shrink-0 text-secondary-label text-3xs">
            {groupedProjectCount} projects
          </span>
        ) : null}
        <span className="min-w-0 truncate text-3xs font-normal text-secondary-label">
          {location}
        </span>
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
