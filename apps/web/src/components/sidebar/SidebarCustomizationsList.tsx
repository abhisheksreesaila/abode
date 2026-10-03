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

import { cn } from "../../lib/utils";
import { useThreadShell } from "../../state/entities";
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
  type CustomizationsScope,
} from "../customizations/CustomizationsSection";
import {
  CustomizationEditorDialog,
  type CustomizationEditorTarget,
} from "../customizations/CustomizationEditor";
import { harnessFromProviderInstance } from "../customizations/newCustomization";
import { Spinner } from "../ui/spinner";

const FOLDERS: ReadonlyArray<{
  readonly kind: CustomizationKind;
  readonly label: string;
  readonly Icon: LucideIcon;
}> = [
  { kind: "skill", label: "Skills", Icon: LightbulbIcon },
  { kind: "agent", label: "Agents", Icon: BotIcon },
  { kind: "instructions", label: "Instructions", Icon: BookOpenIcon },
  { kind: "mcp", label: "MCP Servers", Icon: ServerIcon },
];

/** Hooks and Plugins are left out: no existing service counts them cheaply (abode F-035). */
function CustomizationFolders({ scope }: { readonly scope: CustomizationsScope }) {
  const atom = customizationsEnvironment.list({
    environmentId: scope.environmentId,
    input: { cwd: scope.cwd },
  });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const items = Option.getOrNull(AsyncResult.value(result))?.items ?? null;
  const failure = result._tag === "Failure" ? Cause.squash(result.cause) : null;
  const groups = useMemo(() => (items ? groupCustomizations(items) : null), [items]);
  const [openKinds, setOpenKinds] = useState<ReadonlySet<CustomizationKind>>(new Set());
  // One big editor for both opening a file and creating one (abode F-045).
  const [editing, setEditing] = useState<CustomizationEditorTarget | null>(null);
  const shell = useThreadShell(scope.threadRef);
  const defaultHarness = harnessFromProviderInstance(shell?.modelSelection.instanceId);

  // Edits elsewhere (the file editor) look files up through this cache.
  useEffect(() => {
    if (items) rememberCustomizations(items);
  }, [items]);

  const openFile = useCallback((path: string) => setEditing({ type: "edit", path }), [setEditing]);
  const toggle = (kind: CustomizationKind) =>
    setOpenKinds((current) => {
      const next = new Set(current);
      if (!next.delete(kind)) next.add(kind);
      return next;
    });

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
      {FOLDERS.map(({ kind, label, Icon }) => {
        const group = groups?.find((entry) => entry.kind === kind);
        const open = openKinds.has(kind);
        return (
          <div key={kind}>
            <div className="group/folder flex min-h-[26px] items-center rounded-xs hover:bg-sidebar-row-hover">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(kind)}
                className="flex min-h-[26px] min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-xs px-2 py-0.5 text-start text-xs text-sidebar-foreground outline-hidden ring-ring focus-visible:ring-2"
              >
                <ChevronRightIcon
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0 text-sidebar-muted-foreground",
                    open && "rotate-90",
                  )}
                />
                <Icon aria-hidden className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {group ? (
                  <span className="shrink-0 text-3xs tabular-nums text-muted-foreground">
                    {group.count}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`New ${label}`}
                onClick={() => setEditing({ type: "create", kind, defaultHarness })}
                className="mr-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs text-muted-foreground outline-hidden ring-ring hover:text-foreground focus-visible:ring-2"
              >
                <PlusIcon aria-hidden className="size-3.5" />
              </button>
            </div>
            {open && group ? (
              group.count === 0 ? (
                <div className="py-1 pr-2 pl-8 text-xs text-muted-foreground/80">
                  {group.emptyLabel}
                </div>
              ) : (
                group.items.map((item) => (
                  <ItemRow key={item.path} item={item} disabled={false} onOpen={openFile} />
                ))
              )
            ) : null}
          </div>
        );
      })}
      {editing !== null ? (
        <CustomizationEditorDialog
          // A fresh session per target, so reopening starts from the file on disk.
          key={editing.type === "edit" ? editing.path : `new:${editing.kind}`}
          scope={scope}
          target={editing}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      ) : null}
      {failure === null && groups !== null ? (
        <div className="flex justify-end px-2 pb-0.5">
          <RefreshButton onRefresh={refresh} />
        </div>
      ) : null}
    </>
  );
}

/**
 * The Customizations folders at the foot of the sidebar (abode F-035, F-043): Skills, Agents,
 * Instructions and MCP Servers, always open. A folder expands to its files, a file opens in the
 * big customization editor, and the folder's "+" creates a new one. Counts load once a session's workspace is active.
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
        <CustomizationFolders scope={scope} />
      ) : (
        <div className="px-2 pb-1 text-3xs text-secondary-label">
          Open a session to see its tools
        </div>
      )}
    </section>
  );
});
