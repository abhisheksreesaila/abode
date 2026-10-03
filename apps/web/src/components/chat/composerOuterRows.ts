/**
 * The composer draws two rows outside its glass box: the workspace and harness
 * pickers above it and a plain-text status row below it (access mode,
 * autonomous, worktree and branch). ChatView owns the host elements and the
 * composer portals into them.
 *
 * In the resting or collapsed layouts the controls live in the context strip
 * instead, and with no host (nothing to portal into) the footer keeps them.
 */
export function resolveComposerOuterRows(input: {
  readonly showWorkspaceRow: boolean;
  readonly controlsInStrip: boolean;
  /** The phone composer is collapsed to its one-line form. */
  readonly isCollapsedMobile: boolean;
  readonly isApprovalState: boolean;
  readonly hasTopHost: boolean;
  readonly hasBottomHost: boolean;
}): {
  /** The workspace and harness pickers render above the box; hidden while the phone composer is collapsed. */
  readonly topRow: boolean;
  /** The status row renders below the box. */
  readonly statusRow: boolean;
  /** Access mode and the workspace chips leave the footer and the strip's block list. */
  readonly statusRowOwnsControls: boolean;
} {
  const statusRowOwnsControls = input.hasBottomHost && !input.controlsInStrip;
  return {
    topRow: input.showWorkspaceRow && input.hasTopHost && !input.isCollapsedMobile,
    statusRow: statusRowOwnsControls && !input.isApprovalState,
    statusRowOwnsControls,
  };
}
