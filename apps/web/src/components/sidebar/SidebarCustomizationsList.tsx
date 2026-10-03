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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { useRightPanelStore } from "../../rightPanelStore";
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
import { NewCustomizationDialog } from "../customizations/NewCustomizationDialog";
import { harnessFromProviderInstance } from "../customizations/newCustomization";
import { Spinner } from "../ui/spinner";
import { CustomizationsResizeHandle } from "./CustomizationsResizeHandle";
import {
  clampCustomizationsFraction,
  loadCustomizationsFraction,
  saveCustomizationsFraction,
} from "./customizationsHeight";

/** The header row, the section's top border and its bottom padding: the collapsed height. */
const SECTION_ID = "sidebar-customizations";
const COLLAPSED_HEIGHT_PX = 33;

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
  const [creating, setCreating] = useState<CustomizationKind | null>(null);
  const shell = useThreadShell(scope.threadRef);
  const defaultHarness = harnessFromProviderInstance(shell?.modelSelection.instanceId);

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
                onClick={() => setCreating(kind)}
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
      {creating !== null ? (
        <NewCustomizationDialog
          scope={scope}
          kind={creating}
          defaultHarness={defaultHarness}
          open
          onOpenChange={(next) => {
            if (!next) setCreating(null);
          }}
          onSaved={(path) => {
            refresh();
            openFile(path);
          }}
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
 * side panel, and the folder's "+" creates a new one. Counts load once a session's workspace is active.
 */
export const SidebarCustomizationsList = memo(function SidebarCustomizationsList() {
  const scope = useActiveCustomizationsScope();
  const sectionRef = useRef<HTMLElement>(null);
  // null: not resized, so the section sizes to its content (up to 40%).
  const [fraction, setFraction] = useState<number | null>(loadCustomizationsFraction);
  // The share the content-sized section takes now, for the handle's aria-valuenow.
  const [autoFraction, setAutoFraction] = useState(0.2);

  useEffect(() => {
    const section = sectionRef.current;
    const container = section?.parentElement;
    if (!section || !container || fraction !== null || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      // A drag is writing the height directly; the share is stale until it commits.
      if (section.style.height !== "" || container.clientHeight <= 0) return;
      const share = clampCustomizationsFraction(section.offsetHeight / container.clientHeight);
      setAutoFraction(Math.round(share * 100) / 100);
    });
    observer.observe(section);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fraction]);

  const getContainerHeight = useCallback(
    () => sectionRef.current?.parentElement?.clientHeight ?? 0,
    [],
  );
  // Written straight to the element while dragging; React state follows on release.
  const preview = useCallback((next: number) => {
    const section = sectionRef.current;
    if (!section) return;
    section.style.height = `${next * 100}%`;
    section.style.minHeight = `${COLLAPSED_HEIGHT_PX}px`;
    section.style.maxHeight = "none";
  }, []);
  const commit = useCallback((next: number) => {
    setFraction(next);
    saveCustomizationsFraction(next);
  }, []);
  const reset = useCallback(() => {
    const section = sectionRef.current;
    if (section) {
      section.style.height = "";
      section.style.minHeight = "";
      section.style.maxHeight = "";
    }
    setFraction(null);
    saveCustomizationsFraction(null);
  }, []);

  return (
    <>
      <CustomizationsResizeHandle
        fraction={fraction ?? autoFraction}
        controls={SECTION_ID}
        getContainerHeight={getContainerHeight}
        onPreview={preview}
        onCommit={commit}
        onReset={reset}
      />
      <section
        ref={sectionRef}
        id={SECTION_ID}
        aria-label="Customizations"
        data-testid="customizations-section"
        className={cn(
          "flex min-h-0 flex-col overflow-y-auto border-t border-sidebar-border px-1 pb-1",
          // Once sized, the section may shrink so the footer stays visible on short windows.
          fraction === null ? "max-h-[40%] shrink-0" : "shrink",
        )}
        style={
          fraction === null
            ? undefined
            : { height: `${fraction * 100}%`, minHeight: COLLAPSED_HEIGHT_PX }
        }
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
    </>
  );
});
