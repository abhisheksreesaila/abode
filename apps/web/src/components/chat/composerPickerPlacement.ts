/**
 * Where the harness/model picker renders. A draft shows it in the composer's
 * top row beside the workspace chip; a started thread keeps it in the footer
 * or resting strip so the model can still change mid-thread. It is rendered
 * in exactly one place.
 */
export function resolveModelPickerPlacement(input: {
  readonly routeKind: "server" | "draft";
  readonly hasDraftId: boolean;
  readonly isCollapsedMobile: boolean;
  readonly providerUnavailable: boolean;
}): "top-row" | "footer" {
  return input.routeKind === "draft" &&
    input.hasDraftId &&
    !input.isCollapsedMobile &&
    !input.providerUnavailable
    ? "top-row"
    : "footer";
}

/**
 * The model-picker keybinding must first expand a collapsed composer when the
 * picker lives in the resting strip. In the top row it is always on screen.
 */
export function modelPickerNeedsComposerExpanded(input: {
  readonly placement: "top-row" | "footer";
  readonly stripControlsHidden: boolean;
}): boolean {
  return input.placement === "footer" && input.stripControlsHidden;
}

/** Every draft shows the workspace chip, even when the model picker stays in the footer. */
export function shouldShowWorkspaceRow(input: {
  readonly routeKind: "server" | "draft";
  readonly hasDraftId: boolean;
}): boolean {
  return input.routeKind === "draft" && input.hasDraftId;
}
