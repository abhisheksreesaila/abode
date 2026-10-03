import type { ReactNode } from "react";

import { ComposerPlainControls } from "./ComposerControl";

/**
 * The plain-text row under the composer box: access mode and the autonomous
 * toggle on the left, worktree mode, branch and host on the right. It has no
 * box, border or background; every control inside renders as small muted text
 * (see `ComposerPlainControls`) and stays a menu trigger. It wraps instead of
 * overflowing at narrow widths.
 */
export function ComposerStatusRow(props: { readonly start: ReactNode; readonly end: ReactNode }) {
  return (
    <ComposerPlainControls value>
      {/* The attribute keeps focus and pointer handling treating this row like the strip's controls. */}
      <div
        data-chat-composer-status-row="true"
        data-composer-context-control
        className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 pt-1.5 text-xs font-normal text-muted-foreground/80"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1">{props.start}</div>
        <div className="ms-auto flex min-w-0 items-center gap-1">{props.end}</div>
      </div>
    </ComposerPlainControls>
  );
}
