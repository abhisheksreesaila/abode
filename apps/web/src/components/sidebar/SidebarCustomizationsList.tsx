import { useAtomValue } from "@effect/atom-react";
import type { CustomizationKind } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import { BookOpenIcon, BotIcon, LightbulbIcon, ServerIcon, type LucideIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { useRightPanelStore } from "../../rightPanelStore";
import { customizationsEnvironment } from "../../state/customizations";
import { groupCustomizations } from "../customizations/customizationsModel";
import {
  ItemRow,
  useActiveCustomizationsScope,
  type CustomizationsScope,
} from "../customizations/CustomizationsSection";

const ROWS: ReadonlyArray<{
  readonly kind: CustomizationKind;
  readonly label: string;
  readonly Icon: LucideIcon;
}> = [
  { kind: "mcp", label: "MCP Servers", Icon: ServerIcon },
  { kind: "skill", label: "Skills", Icon: LightbulbIcon },
  { kind: "instructions", label: "Instructions", Icon: BookOpenIcon },
  { kind: "agent", label: "Agents", Icon: BotIcon },
];

/** Hooks and Plugins are left out: no existing service counts them cheaply (abode F-035). */
function CustomizationsRows({ scope }: { readonly scope: CustomizationsScope }) {
  const result = useAtomValue(
    customizationsEnvironment.list({
      environmentId: scope.environmentId,
      input: { cwd: scope.cwd },
    }),
  );
  const items = Option.getOrNull(AsyncResult.value(result))?.items ?? null;
  const groups = useMemo(() => (items ? groupCustomizations(items) : null), [items]);
  const [openKind, setOpenKind] = useState<CustomizationKind | null>(null);
  const openFile = useCallback(
    (path: string) => {
      if (scope.threadRef) useRightPanelStore.getState().openFile(scope.threadRef, path);
    },
    [scope.threadRef],
  );

  return (
    <>
      {ROWS.map(({ kind, label, Icon }) => {
        const group = groups?.find((entry) => entry.kind === kind);
        const open = openKind === kind;
        return (
          <div key={kind}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenKind(open ? null : kind)}
              className={cn(
                "flex min-h-[26px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-xs px-2 py-0.5 text-start text-xs text-sidebar-foreground outline-hidden ring-ring hover:bg-sidebar-row-hover focus-visible:ring-2",
              )}
            >
              <Icon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {group ? (
                <span className="shrink-0 text-3xs tabular-nums text-muted-foreground">
                  {group.count}
                </span>
              ) : null}
            </button>
            {open && group ? (
              group.count === 0 ? (
                <div className="py-1 pl-8 text-xs text-muted-foreground/80">{group.emptyLabel}</div>
              ) : (
                group.items.map((item) => (
                  <ItemRow
                    key={item.path}
                    item={item}
                    disabled={scope.threadRef === null}
                    onOpen={openFile}
                  />
                ))
              )
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/**
 * The always-visible Customizations list at the foot of the Sessions sidebar
 * (abode F-035). Counts load lazily once a thread's workspace is active; a row
 * expands its files inline, and a file opens in the side panel.
 */
export const SidebarCustomizationsList = memo(function SidebarCustomizationsList() {
  const scope = useActiveCustomizationsScope();
  return (
    <section
      aria-label="Customizations"
      data-testid="customizations-section"
      className="flex max-h-[40%] min-h-0 shrink-0 flex-col overflow-y-auto border-t border-sidebar-border px-1 pb-1"
    >
      <div className="flex h-7 shrink-0 items-center px-2 text-xs font-semibold text-sidebar-foreground">
        Customizations
      </div>
      {scope ? (
        <CustomizationsRows scope={scope} />
      ) : (
        <div className="px-2 pb-1 text-3xs text-secondary-label">
          Open a session to see its tools
        </div>
      )}
    </section>
  );
});
