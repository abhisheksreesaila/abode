import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type {
  CustomizationHarness,
  CustomizationItem,
  CustomizationKind,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
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

import { Badge } from "~/components/ui/badge";
import { Spinner } from "~/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useThreadShell } from "~/state/entities";
import { observeResize } from "~/lib/observeResize";
import { cn } from "~/lib/utils";
import { useRightPanelStore } from "~/rightPanelStore";

import { CustomizationsResizeHandle } from "./CustomizationsResizeHandle";
import {
  clampCustomizationsFraction,
  loadCustomizationsFraction,
  saveCustomizationsFraction,
} from "./customizationsHeight";
import {
  describeCustomizationsError,
  groupCustomizations,
  rememberCustomizations,
} from "./customizationsModel";
import { customizationsEnvironment } from "./customizationsState";
import { isSkillFile } from "./editorModel";
import { useRefreshProviderSkills } from "./useRefreshProviderSkills";
import { harnessFromProviderInstance } from "./newCustomization";
import { NewCustomizationDialog } from "./NewCustomizationDialog";
import { useActiveCustomizationsScope, type CustomizationsScope } from "./useCustomizationsScope";

const SECTION_ID = "abode-customizations";
/** The header row and the section's top border: the collapsed height. */
const COLLAPSED_HEIGHT_PX = 33;

const FOLDERS: ReadonlyArray<{
  readonly kind: CustomizationKind;
  readonly label: string;
  readonly Icon: LucideIcon;
}> = [
  { kind: "skill", label: "Skills", Icon: LightbulbIcon },
  { kind: "agent", label: "Agents", Icon: BotIcon },
  { kind: "mcp", label: "MCP servers", Icon: ServerIcon },
  { kind: "instructions", label: "Instructions", Icon: BookOpenIcon },
];

function ItemRow(props: {
  readonly item: CustomizationItem;
  readonly disabled: boolean;
  readonly onOpen: (path: string) => void;
}) {
  const { item, disabled, onOpen } = props;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            onClick={() => onOpen(item.path)}
            data-testid="customization-item"
            className="flex h-[26px] w-full cursor-pointer items-center gap-1.5 rounded-xs py-0 pr-2 pl-8 text-start text-xs text-sidebar-foreground outline-hidden ring-ring hover:bg-sidebar-row-hover focus-visible:ring-1 focus-visible:ring-inset disabled:cursor-default disabled:opacity-60"
          />
        }
      >
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        {item.harness === "codex" ? (
          <Badge size="sm" variant="outline">
            Codex
          </Badge>
        ) : null}
        <Badge size="sm" variant={item.scope === "user" ? "info" : "secondary"}>
          {item.scope === "user" ? "user" : "workspace"}
        </Badge>
      </TooltipTrigger>
      <TooltipPopup side="right">{item.description || item.name}</TooltipPopup>
    </Tooltip>
  );
}

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
  const [openKinds, setOpenKinds] = useState<ReadonlySet<CustomizationKind>>(new Set(["skill"]));
  const [creating, setCreating] = useState<CustomizationKind | null>(null);
  const shell = useThreadShell(scope.threadRef);
  const refreshSkills = useRefreshProviderSkills({
    environmentId: scope.environmentId,
    threadRef: scope.threadRef,
    workspaceRoot: scope.cwd,
  });
  const defaultHarness: CustomizationHarness = harnessFromProviderInstance(
    shell?.modelSelection.instanceId,
  );

  // The editor tells user files from workspace ones by looking them up here.
  useEffect(() => {
    if (items) rememberCustomizations(items);
  }, [items]);

  // Skills are edited on disk by Claude itself and by other tools: re-read when the window returns.
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

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
        <div className="px-2 py-0.5 text-xs text-destructive">
          {describeCustomizationsError(failure)}
        </div>
      ) : null}
      {FOLDERS.map(({ kind, label, Icon }) => {
        const group = groups?.find((entry) => entry.kind === kind);
        const open = openKinds.has(kind);
        return (
          <div key={kind}>
            <div className="flex min-h-[26px] items-center rounded-xs hover:bg-sidebar-row-hover">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(kind)}
                className="flex min-h-[26px] min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-xs px-2 text-start text-xs text-sidebar-foreground outline-hidden ring-ring focus-visible:ring-1 focus-visible:ring-inset"
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
                  <span className="shrink-0 text-3xs tabular-nums text-sidebar-muted-foreground">
                    {group.count}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={
                  scope.threadRef === null ? `New ${label} (open a session first)` : `New ${label}`
                }
                disabled={scope.threadRef === null}
                onClick={() => setCreating(kind)}
                className="mr-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs text-sidebar-muted-foreground outline-hidden ring-ring hover:text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-inset"
              >
                <PlusIcon aria-hidden className="size-3.5" />
              </button>
            </div>
            {open && group ? (
              group.count === 0 ? (
                <div className="flex items-center gap-2 py-1 pr-2 pl-8 text-xs text-sidebar-muted-foreground">
                  <span>{group.emptyLabel}</span>
                  <button
                    type="button"
                    disabled={scope.threadRef === null}
                    onClick={() => setCreating(kind)}
                    className="cursor-pointer disabled:cursor-default disabled:opacity-60 text-primary hover:underline"
                  >
                    Create one
                  </button>
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
          onClose={() => setCreating(null)}
          onReady={(path) => {
            setCreating(null);
            refresh();
            if (isSkillFile(path)) refreshSkills();
            openFile(path);
          }}
        />
      ) : null}
    </>
  );
}

/** The slot wrapper is `display: contents`, so the section's sizing box is the sidebar itself. */
function sidebarOf(section: HTMLElement | null): HTMLElement | null {
  return section?.closest("[data-abode-slot]")?.parentElement ?? null;
}

/**
 * The Customizations section at the foot of the abode sidebar: Skills, Agents, MCP servers and
 * Instructions, user-wide and for the active workspace. A drag handle above it resizes the section
 * from collapsed to most of the sidebar; the size is remembered and double-click resets it.
 */
export const CustomizationsSection = memo(function CustomizationsSection() {
  const scope = useActiveCustomizationsScope();
  const sectionRef = useRef<HTMLElement>(null);
  // null: not resized, so the section sizes to its content (up to 40%).
  const [fraction, setFraction] = useState<number | null>(loadCustomizationsFraction);
  // The share the content-sized section takes now, for the handle's aria-valuenow.
  const [autoFraction, setAutoFraction] = useState(0.2);

  useEffect(() => {
    const section = sectionRef.current;
    const container = sidebarOf(section);
    if (!section || !container || fraction !== null) return;
    return observeResize([section, container], () => {
      // A drag writes the height straight to the element; the share is stale until it commits.
      if (section.style.height !== "" || container.clientHeight <= 0) return;
      const share = clampCustomizationsFraction(section.offsetHeight / container.clientHeight);
      setAutoFraction(Math.round(share * 100) / 100);
    });
  }, [fraction]);

  const getContainerHeight = useCallback(
    () => sidebarOf(sectionRef.current)?.clientHeight ?? 0,
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
        <div className="flex h-7 shrink-0 items-center gap-1 px-2 text-xs font-semibold text-sidebar-foreground">
          <span className="min-w-0 flex-1 truncate">Customizations</span>
          {scope ? (
            <span className="max-w-[40%] truncate text-3xs font-normal text-sidebar-muted-foreground">
              {scope.projectName}
            </span>
          ) : null}
        </div>
        {scope ? (
          <CustomizationFolders scope={scope} />
        ) : (
          <div className="px-2 pb-1 text-3xs text-sidebar-muted-foreground">
            Open a session to see its skills and agents
          </div>
        )}
      </section>
    </>
  );
});
