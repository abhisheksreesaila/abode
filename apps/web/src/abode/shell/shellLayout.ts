import type { CSSProperties } from "react";

/**
 * Provider-level CSS variables for the shell. `AppSidebarLayout` spreads this
 * into the sidebar provider's style before its own macOS override, so on macOS
 * the traffic-light inset still wins.
 *
 * Upstream floats the sidebar toggle at `--workspace-controls-left` (12px from
 * the window edge). With the activity bar in that corner the toggle moves to
 * just right of it, and the padding that clears the toggle shrinks by the
 * rail's width because content now starts after the rail.
 */
export const abodeShellProviderStyle = {
  "--workspace-controls-left":
    "calc(env(safe-area-inset-left) + var(--abode-activity-bar-width) + 0.75rem)",
  "--workspace-titlebar-content-left":
    "calc(var(--workspace-controls-left) + var(--workspace-titlebar-control-size) + var(--workspace-titlebar-control-gap) - var(--abode-activity-bar-width))",
} as CSSProperties;
