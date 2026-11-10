import { BoxIcon } from "lucide-react";

import { ITEM_ICON_CLASS, type CommandPaletteActionItem } from "~/components/CommandPalette.logic";

import { requestOpenKit } from "./KitOpener";

/** The command palette's "Open Kit" row. */
export function abodeKitActions(): CommandPaletteActionItem[] {
  return [
    {
      kind: "action",
      value: "action:abode-open-kit",
      searchTerms: ["kit", "skills", "mcp", "plugins", "hooks", "skill updates", "prune"],
      title: "Open Kit",
      icon: <BoxIcon className={ITEM_ICON_CLASS} />,
      run: async () => requestOpenKit(),
    },
  ];
}
