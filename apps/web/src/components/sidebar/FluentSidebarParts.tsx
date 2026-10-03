import type { ReactNode } from "react";

import { isElectron } from "../../env";
import { cn } from "../../lib/utils";
import { threadSquareTone, type ThreadSquareTone } from "./workspaceList";

const SQUARE_TONE_CLASS: Record<ThreadSquareTone, string> = {
  running: "bg-success",
  "needs-you": "bg-warning",
  done: "border border-success bg-transparent",
  idle: "bg-muted-foreground/40",
};

/**
 * The row under the sidebar's top strip (abode F-035, F-047): "Workspaces", with New, filter and search
 * on the right.
 */
export function SidebarSessionsHeader({ children }: { readonly children?: ReactNode }) {
  return (
    <>
      <div
        className={cn(
          "flex h-[35px] shrink-0 items-center justify-between pl-3 pr-1.5",
          isElectron && "drag-region",
        )}
      >
        <span className="text-2xs font-semibold tracking-wide text-sidebar-foreground uppercase">
          Workspaces
        </span>
        <div className="flex items-center gap-0.5">{children}</div>
      </div>
    </>
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

/** The small dot on a thread row. It does not animate: running is green, not a pulse. */
export function ThreadStatusSquare({ statusLabel }: { readonly statusLabel: string | null }) {
  const tone = threadSquareTone(statusLabel);
  return (
    <span
      role="img"
      aria-label={statusLabel ?? "Idle"}
      data-status-tone={tone}
      className={cn("size-1.5 shrink-0 rounded-full", SQUARE_TONE_CLASS[tone])}
    />
  );
}
