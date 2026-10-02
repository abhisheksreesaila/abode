import { ChevronRightIcon } from "lucide-react";

import { requestPanelToggle } from "../panelToggleBus";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

// VS Code file tabs for the right drawer (abode F-030): flat tabs on the
// sidebar-colored strip, divided by 1px lines. The selected tab takes the
// editor background and a 1px accent line along its top edge.
export const RIGHT_PANEL_TAB_STRIP_CLASS = "bg-sidebar border-b border-border/60 pl-0 gap-0";

export const RIGHT_PANEL_TAB_CLASS =
  "cursor-pointer group/tab relative flex h-8 max-w-44 shrink-0 items-center gap-0.5 border-r border-border/60 pr-2.5 pl-2 text-sm";

export const RIGHT_PANEL_TAB_ACTIVE_CLASS =
  "bg-background text-foreground before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-primary";

export const RIGHT_PANEL_TAB_INACTIVE_CLASS =
  "text-muted-foreground hover:bg-accent/60 hover:text-foreground";

/**
 * The drawer's close control, at the right end of the tab strip. It uses the
 * same bus as the key, the status bar and the header toggle. There is no split
 * control beside it because the right drawer has no split.
 */
export function RightPanelCloseButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Close side panel"
            data-right-panel-close
            className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground [-webkit-app-region:no-drag]"
            onClick={() => requestPanelToggle("rightPanel")}
          />
        }
      >
        <ChevronRightIcon aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipPopup side="bottom">Close side panel</TooltipPopup>
    </Tooltip>
  );
}
