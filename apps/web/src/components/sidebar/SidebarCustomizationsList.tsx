import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { CustomizationKind } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import {
  BookOpenIcon,
  BotIcon,
  ChevronRightIcon,
  LightbulbIcon,
  PlusIcon,
  ServerIcon,
  type LucideIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { useIsMobile } from "../../hooks/useMediaQuery";
import { cn } from "../../lib/utils";
import { useRightPanelStore } from "../../rightPanelStore";
import { customizationsEnvironment } from "../../state/customizations";
import {
  describeCustomizationsError,
  groupCustomizations,
  rememberCustomizations,
} from "../customizations/customizationsModel";
import {
  ItemRow,
  RefreshButton,
  useActiveCustomizationsScope,
  useCreateCustomization,
  type CustomizationsScope,
} from "../customizations/CustomizationsSection";
import { Spinner } from "../ui/spinner";

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
  const atom = customizationsEnvironment.list({
    environmentId: scope.environmentId,
    input: { cwd: scope.cwd },
  });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const items = Option.getOrNull(AsyncResult.value(result))?.items ?? null;
  const failure = result._tag === "Failure" ? Cause.squash(result.cause) : null;
  const groups = useMemo(() => (items ? groupCustomizations(items) : null), [items]);
  const [openKind, setOpenKind] = useState<CustomizationKind | null>(null);

  // Edits elsewhere (the file editor) look files up through this cache.
  useEffect(() => {
    if (items) rememberCustomizations(items);
  }, [items]);

  const openFile = useCallback(
    (path: string) => {
      if (scope.threadRef) useRightPanelStore.getState().openFile(scope.threadRef, path);
    },
    [scope.threadRef],
  );
  const createFirst = useCreateCustomization({ scope, items, refresh, openItem: openFile });

  return (
    <>
      {groups === null && failure === null ? (
        <div className="flex justify-center py-2 text-muted-foreground">
          <Spinner size="sm" />
        </div>
      ) : null}
      {failure !== null ? (
        <div className="flex items-start gap-2 px-2 py-0.5 text-xs">
          <span className="min-w-0 flex-1 text-destructive">
            {describeCustomizationsError(failure)}
          </span>
          <RefreshButton onRefresh={refresh} />
        </div>
      ) : null}
      {ROWS.map(({ kind, label, Icon }) => {
        const group = groups?.find((entry) => entry.kind === kind);
        const open = openKind === kind;
        return (
          <div key={kind}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenKind(open ? null : kind)}
              className="flex min-h-[26px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-xs px-2 py-0.5 text-start text-xs text-sidebar-foreground outline-hidden ring-ring hover:bg-sidebar-row-hover focus-visible:ring-2"
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
                <div className="flex items-center gap-2 py-1 pr-2 pl-8 text-xs text-muted-foreground/80">
                  <span>{group.emptyLabel}</span>
                  {kind === "skill" || kind === "agent" ? (
                    <button
                      type="button"
                      onClick={() => void createFirst(kind)}
                      className="inline-flex cursor-pointer items-center gap-0.5 text-primary hover:underline"
                    >
                      <PlusIcon className="size-3" />
                      Create one
                    </button>
                  ) : null}
                </div>
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
      {failure === null && groups !== null ? (
        <div className="flex justify-end px-2 pb-0.5">
          <RefreshButton onRefresh={refresh} />
        </div>
      ) : null}
    </>
  );
}

/**
 * The Customizations list at the foot of the Sessions sidebar (abode F-035). Counts load
 * lazily once a thread's workspace is active; a row expands its files inline, and a file
 * opens in the side panel. On phones the whole list starts collapsed.
 */
export const SidebarCustomizationsList = memo(function SidebarCustomizationsList() {
  const scope = useActiveCustomizationsScope();
  const isMobile = useIsMobile();
  const [openOnPhone, setOpenOnPhone] = useState(false);
  const showRows = !isMobile || openOnPhone;
  return (
    <section
      aria-label="Customizations"
      data-testid="customizations-section"
      className="flex max-h-[40%] min-h-0 shrink-0 flex-col overflow-y-auto border-t border-sidebar-border px-1 pb-1"
    >
      {isMobile ? (
        <button
          type="button"
          aria-expanded={openOnPhone}
          onClick={() => setOpenOnPhone((current) => !current)}
          className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 px-2 text-left text-xs font-semibold text-sidebar-foreground"
        >
          <ChevronRightIcon className={cn("size-3.5 shrink-0", openOnPhone && "rotate-90")} />
          Customizations
        </button>
      ) : (
        <div className="flex h-7 shrink-0 items-center px-2 text-xs font-semibold text-sidebar-foreground">
          Customizations
        </div>
      )}
      {!showRows ? null : scope ? (
        <CustomizationsRows scope={scope} />
      ) : (
        <div className="px-2 pb-1 text-3xs text-secondary-label">
          Open a session to see its tools
        </div>
      )}
    </section>
  );
});
