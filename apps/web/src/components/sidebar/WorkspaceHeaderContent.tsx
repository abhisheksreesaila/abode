import { ChevronRightIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { workspaceInitials, type WorkspacePill, type WorkspacePillKind } from "./workspaceList";

const PILL_VARIANT = {
  "needs-you": "warning",
  failed: "error",
  running: "info",
  done: "success",
} as const satisfies Record<WorkspacePillKind, string>;

/**
 * The inside of a workspace header button (abode F-024): chevron, colored
 * initials tile, name over location, and a right-aligned status pill that
 * stays visible while the workspace is collapsed.
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
  return (
    <>
      <ChevronRightIcon
        className={cn(
          "-ml-0.5 size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150",
          expanded && "rotate-90",
        )}
      />
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-3xs font-bold text-background"
        style={color ? { backgroundColor: color } : undefined}
      >
        {workspaceInitials(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-sidebar-foreground">{name}</span>
          {groupedProjectCount > 1 ? (
            <span className="shrink-0 text-secondary-label text-3xs">
              {groupedProjectCount} projects
            </span>
          ) : null}
        </span>
        <span className="truncate font-mono text-3xs font-normal text-secondary-label">
          {location}
        </span>
      </span>
      {pill ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge
                size="sm"
                variant={PILL_VARIANT[pill.kind]}
                data-testid="workspace-status-pill"
              />
            }
          >
            {pill.label}
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
