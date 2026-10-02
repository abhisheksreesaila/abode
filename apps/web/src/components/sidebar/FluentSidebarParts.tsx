import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { threadSquareTone, type ThreadSquareTone } from "./workspaceList";

const SQUARE_TONE_CLASS: Record<ThreadSquareTone, string> = {
  running: "bg-success",
  "needs-you": "bg-warning",
  done: "bg-primary",
  idle: "bg-muted-foreground/40",
};

/**
 * The sidebar's top row (abode F-028): "AGENTS" with the sidebar's existing
 * actions on the right.
 */
export function SidebarAgentsHeader({ children }: { readonly children?: ReactNode }) {
  return (
    <div className="flex h-[35px] shrink-0 items-center justify-between pl-3 pr-1.5">
      <span className="text-3xs font-medium uppercase tracking-wide text-sidebar-muted-foreground">
        Agents
      </span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

/** A 22px section header: bold uppercase label, dim count on the right. */
export function SidebarSectionHeader({
  label,
  count,
  className,
}: {
  readonly label: string;
  readonly count?: number;
  readonly className?: string;
}) {
  return (
    <div className={cn("flex h-[22px] items-center justify-between px-2", className)}>
      <span className="text-3xs font-bold uppercase tracking-wide text-sidebar-foreground">
        {label}
      </span>
      {count === undefined ? null : (
        <span className="text-3xs tabular-nums text-secondary-label">{count}</span>
      )}
    </div>
  );
}

/** The 7px square on a thread row. It does not animate: running is green, not a pulse. */
export function ThreadStatusSquare({ statusLabel }: { readonly statusLabel: string | null }) {
  const tone = threadSquareTone(statusLabel);
  return (
    <span
      role="img"
      aria-label={statusLabel ?? "Idle"}
      data-status-tone={tone}
      className={cn("size-[7px] shrink-0 rounded-xs", SQUARE_TONE_CLASS[tone])}
    />
  );
}
