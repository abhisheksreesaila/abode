import { useCanGoBack } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { memo } from "react";

import { useCanGoForward } from "~/hooks/useCanGoForward";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarToggleControl } from "./PanelLayoutControls";

/**
 * Left end of the top bar (abode F-037): sidebar toggle, then back/forward over
 * the same browser history the navigation.back/forward keybindings use.
 */
export const HeaderNavControls = memo(function HeaderNavControls() {
  const canGoBack = useCanGoBack();
  const canGoForward = useCanGoForward();
  return (
    <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">
      <SidebarToggleControl />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-toolbar"
              variant="toolbar"
              aria-label="Go back"
              disabled={!canGoBack}
              className="hidden md:inline-flex"
              onClick={() => window.history.back()}
            />
          }
        >
          <ArrowLeftIcon className="size-4" />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Back</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-toolbar"
              variant="toolbar"
              aria-label="Go forward"
              disabled={!canGoForward}
              className="hidden md:inline-flex"
              onClick={() => window.history.forward()}
            />
          }
        >
          <ArrowRightIcon className="size-4" />
        </TooltipTrigger>
        <TooltipPopup side="bottom">Forward</TooltipPopup>
      </Tooltip>
    </div>
  );
});
