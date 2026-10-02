import { useAtomValue } from "@effect/atom-react";
import { SearchIcon } from "lucide-react";
import { memo } from "react";

import { openCommandPalette } from "../../commandPaletteBus";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { formatTitleSearchLabel } from "../statusBar/statusBar.logic";

/**
 * The header's command box (abode F-030): `project — thread`, centered between
 * the breadcrumb and the actions, that opens the command palette. The app has
 * no window-wide title row, so this sits in the chat column's header, which is
 * the title area; it hides when the column is too narrow to spare the room.
 */
export const TitleSearchBox = memo(function TitleSearchBox(props: {
  readonly projectName: string | null;
  readonly threadTitle: string | null;
}) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const shortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const label = formatTitleSearchLabel(props.projectName, props.threadTitle);
  return (
    <button
      type="button"
      aria-label={`Search commands and threads, ${label}`}
      data-title-search
      onClick={() => openCommandPalette()}
      className="hidden h-6 w-105 min-w-40 shrink cursor-pointer items-center gap-2 rounded-sm border border-input bg-background px-2 text-left text-xs text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring @2xl/header-actions:flex [-webkit-app-region:no-drag]"
    >
      <SearchIcon aria-hidden className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut ? <span className="shrink-0 text-muted-foreground/70">{shortcut}</span> : null}
    </button>
  );
});
