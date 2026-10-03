import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/utils";
import { TopBarAccountControls, TopBarAccountOverflowMenu } from "./chat/TopBarAccountControls";
import { UtilityBackButton } from "./UtilityBackButton";
import { COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS } from "../workspaceTitlebar";

/** Shared workspace top-bar geometry. */
export function WorkspacePageHeader({
  electron = false,
  reserveNativeControls = electron,
  accountControls = false,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"header"> & {
  readonly electron?: boolean;
  readonly reserveNativeControls?: boolean;
  /** Usage and Settings at the right end (F-044, trimmed in F-049). */
  readonly accountControls?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex h-[var(--workspace-topbar-height)] min-h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 pl-(--workspace-gutter-start) pr-(--workspace-gutter-end) [[data-panel-animations=true]_&]:motion-safe:transition-[padding-left,padding-right] [[data-panel-animations=true]_&]:motion-safe:duration-(--panel-animation-duration) [[data-panel-animations=true]_&]:motion-safe:ease-out",
        electron && "drag-region",
        reserveNativeControls && "wco:pr-(--workspace-native-controls-inset)",
        COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS,
        className,
      )}
      {...props}
    >
      <UtilityBackButton />
      {children}
      {accountControls ? (
        <div className="ms-auto flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">
          <div className="hidden md:flex">
            <TopBarAccountControls />
          </div>
          <TopBarAccountOverflowMenu />
        </div>
      ) : null}
    </header>
  );
}
