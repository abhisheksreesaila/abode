import { ChevronDownIcon } from "lucide-react";
import { memo } from "react";

import { requestPanelToggle } from "../panelToggleBus";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

/**
 * The bottom panel's VS Code-style header (abode F-030): panel tabs on the
 * left, the active shell's context and a close control on the right. Only
 * TERMINAL is offered. T3 has no diagnostics source for a Problems tab and
 * no agent log stream for an Output tab, and the design says not to fake
 * either. The top 6px is padding: the drawer's resize handle covers it. Close goes through the same bus as the key and the status bar.
 */
export const TerminalPanelHeader = memo(function TerminalPanelHeader(props: {
  readonly context: string;
  readonly closeShortcutLabel?: string | null | undefined;
}) {
  return (
    <div
      className="flex h-8 shrink-0 pt-1.5 items-stretch border-b border-border/60 bg-sidebar pl-2 pr-1 text-2xs uppercase tracking-wide"
      data-terminal-panel-header
    >
      <div role="tablist" aria-label="Panel" className="flex items-stretch">
        <button
          type="button"
          role="tab"
          aria-selected
          className="relative cursor-default px-2 font-medium text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-px after:bg-primary"
        >
          Terminal
        </button>
      </div>
      <span className="flex-1" />
      {props.context ? (
        <span className="mr-1 flex min-w-0 items-center truncate px-1 normal-case text-muted-foreground/70">
          {props.context}
        </span>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Close panel"
              className="inline-flex w-6 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => requestPanelToggle("terminal")}
            />
          }
        >
          <ChevronDownIcon aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup side="top">
          Close panel{props.closeShortcutLabel ? ` (${props.closeShortcutLabel})` : ""}
        </TooltipPopup>
      </Tooltip>
    </div>
  );
});
