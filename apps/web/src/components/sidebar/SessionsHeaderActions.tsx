import { SearchIcon } from "lucide-react";
import { memo, useCallback } from "react";

import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { startNewThreadFromContext } from "../../lib/chatThreadActions";
import { Button } from "../ui/button";
import { CommandDialogTrigger } from "../ui/command";
import { Kbd } from "../ui/kbd";
import { useSidebar } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/**
 * "New" with its shortcut hint, and Search, for the Sessions header (abode F-035).
 * New starts a thread the way the new-thread shortcut does, from the current context.
 */
export const SessionsHeaderActions = memo(function SessionsHeaderActions({
  newThreadShortcutLabel,
  searchShortcutLabel,
}: {
  readonly newThreadShortcutLabel: string | null;
  readonly searchShortcutLabel: string | null;
}) {
  const { activeDraftThread, activeThread, defaultProjectRef, handleNewThread } =
    useHandleNewThread();
  const { isMobile, setOpenMobile } = useSidebar();
  const startNew = useCallback(() => {
    if (isMobile) setOpenMobile(false);
    void startNewThreadFromContext({
      activeDraftThread,
      activeThread: activeThread ?? undefined,
      defaultProjectRef,
      handleNewThread,
    });
  }, [
    activeDraftThread,
    activeThread,
    defaultProjectRef,
    handleNewThread,
    isMobile,
    setOpenMobile,
  ]);

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        data-testid="sessions-new"
        aria-label="New session"
        onClick={startNew}
      >
        New
        {newThreadShortcutLabel ? <Kbd>{newThreadShortcutLabel}</Kbd> : null}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <CommandDialogTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label="Search"
                  data-testid="command-palette-trigger"
                />
              }
            />
          }
        >
          <SearchIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup side="bottom">
          {searchShortcutLabel ? `Search (${searchShortcutLabel})` : "Search"}
        </TooltipPopup>
      </Tooltip>
    </>
  );
});
