import { useAtomValue } from "@effect/atom-react";
import { SearchIcon } from "lucide-react";
import { memo } from "react";

import { openCommandPalette } from "../../commandPaletteBus";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { formatTitleSearchLabel } from "../statusBar/statusBar.logic";

/**
 * The top bar's one center box (abode F-037): the workspace name, or "New
 * session", that opens the command palette. It takes the spare width and
 * shrinks (truncating) before anything beside it has to hide.
 */
export const TitleSearchBox = memo(function TitleSearchBox(props: {
  readonly projectName: string | null;
}) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const shortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const label = formatTitleSearchLabel(props.projectName);
  return (
    <button
      type="button"
      aria-label={`Search commands and threads, ${label}`}
      data-title-search
      onClick={() => openCommandPalette()}
      className="flex h-7 w-full min-w-0 max-w-xl flex-1 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring [-webkit-app-region:no-drag]"
    >
      <SearchIcon aria-hidden className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? (
        <span className="hidden shrink-0 text-muted-foreground/70 @lg/header-actions:inline">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
});
