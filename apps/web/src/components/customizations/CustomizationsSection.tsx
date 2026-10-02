import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { useParams } from "@tanstack/react-router";
import {
  type CustomizationItem,
  type EnvironmentId,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AsyncResult } from "effect/unstable/reactivity";
import { ChevronRightIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Spinner } from "~/components/ui/spinner";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";
import { useRightPanelStore } from "~/rightPanelStore";
import { useProject, useThreadShell } from "~/state/entities";
import { customizationsEnvironment } from "~/state/customizations";
import { useAtomCommand } from "~/state/use-atom-command";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "~/threadRoutes";

import {
  type CustomizationGroup,
  type NewCustomizationKind,
  describeCustomizationsError,
  groupCustomizations,
  newCustomizationTemplate,
  nextNewCustomization,
  rememberCustomizations,
} from "./customizationsModel";

const EXPANDED_STORAGE_KEY = "abode.customizationsExpanded";

export interface CustomizationsScope {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly projectName: string;
  /** Null for an unsent draft: there is no thread whose side panel could open a file. */
  readonly threadRef: ScopedThreadRef | null;
}

/** The active thread's project; customizations are per workspace, not per worktree. */
export function useActiveCustomizationsScope(): CustomizationsScope | null {
  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const routeDraft = useComposerDraftStore((store) =>
    routeTarget?.kind === "draft" ? store.getDraftSession(routeTarget.draftId) : null,
  );
  const threadRef = resolveActiveThreadRouteRef(routeTarget, routeDraft);
  const shell = useThreadShell(threadRef);
  const source = shell ?? routeDraft;
  const projectRef = useMemo(
    () => (source ? scopeProjectRef(source.environmentId, source.projectId) : null),
    [source],
  );
  const project = useProject(projectRef);
  if (!source || !project?.workspaceRoot) return null;
  return {
    environmentId: source.environmentId,
    cwd: project.workspaceRoot,
    projectName: project.title,
    threadRef,
  };
}

/** Shared with the footer's Customizations row, which opens and closes the section. */
export function useCustomizationsExpanded() {
  return useLocalStorage(EXPANDED_STORAGE_KEY, false, Schema.Boolean);
}

/**
 * Bottom-of-sidebar list of the workspace's Claude skills, agents, MCP servers and instructions.
 * Collapsed, it is just the footer's Customizations row.
 */
export function CustomizationsSection() {
  const scope = useActiveCustomizationsScope();
  const [expanded, setExpanded] = useCustomizationsExpanded();
  if (!scope || !expanded) return null;

  return (
    <section
      aria-label="Customizations"
      className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-t border-sidebar-border"
      data-testid="customizations-section"
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 px-3 text-left text-2xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
            />
          }
        >
          <ChevronRightIcon className={cn("size-3.5 shrink-0", expanded && "rotate-90")} />
          <span className="min-w-0 flex-1 truncate">Customizations · {scope.projectName}</span>
        </TooltipTrigger>
        <TooltipPopup side="right">Edits apply to the main checkout</TooltipPopup>
      </Tooltip>
      {expanded ? <CustomizationsBody scope={scope} /> : null}
    </section>
  );
}

/** Mounted only while expanded, so collapsed sidebars never fetch the list. */
function CustomizationsBody({ scope }: { readonly scope: CustomizationsScope }) {
  const atom = customizationsEnvironment.list({
    environmentId: scope.environmentId,
    input: { cwd: scope.cwd },
  });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const items = Option.getOrNull(AsyncResult.value(result))?.items ?? null;
  const failure = result._tag === "Failure" ? Cause.squash(result.cause) : null;

  useEffect(() => {
    if (items) rememberCustomizations(items);
  }, [items]);

  const openItem = useCallback(
    (path: string) => {
      if (scope.threadRef) useRightPanelStore.getState().openFile(scope.threadRef, path);
    },
    [scope.threadRef],
  );

  const createFirst = useCallback(
    async (kind: NewCustomizationKind) => {
      const { name, path } = nextNewCustomization(
        kind,
        scope.cwd,
        (items ?? []).map((item) => item.path),
      );
      const written = await writeFile({
        environmentId: scope.environmentId,
        input: { cwd: scope.cwd, path, contents: newCustomizationTemplate(kind, name) },
      });
      if (written._tag === "Success") {
        refresh();
        openItem(path);
        return;
      }
      if (isAtomCommandInterrupted(written)) return;
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Couldn't create the ${kind}`,
          description: describeCustomizationsError(squashAtomCommandFailure(written)),
        }),
      );
    },
    [items, openItem, refresh, scope.cwd, scope.environmentId, writeFile],
  );

  const groups = useMemo(() => (items ? groupCustomizations(items) : null), [items]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-2">
      {groups === null && failure === null ? (
        <div className="flex justify-center py-3 text-muted-foreground">
          <Spinner size="sm" />
        </div>
      ) : null}
      <div className="flex items-start gap-2 px-3 py-0.5 text-xs">
        <span className="min-w-0 flex-1 text-destructive">
          {failure !== null ? describeCustomizationsError(failure) : null}
        </span>
        <RefreshButton onRefresh={refresh} />
      </div>
      {groups?.map((group) => {
        const kind = group.kind;
        return (
          <GroupRows
            key={kind}
            group={group}
            canOpen={scope.threadRef !== null}
            onOpen={openItem}
            onCreate={
              kind === "skill" || kind === "agent" ? () => void createFirst(kind) : undefined
            }
          />
        );
      })}
    </div>
  );
}

function RefreshButton({ onRefresh }: { readonly onRefresh: () => void }) {
  return (
    <button
      type="button"
      aria-label="Refresh customizations"
      onClick={onRefresh}
      className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
    >
      <RefreshCwIcon className="size-3" />
    </button>
  );
}

function GroupRows({
  group,
  canOpen,
  onOpen,
  onCreate,
}: {
  readonly group: CustomizationGroup;
  readonly canOpen: boolean;
  readonly onOpen: (path: string) => void;
  readonly onCreate: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-6 w-full cursor-pointer items-center gap-1 px-3 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon className={cn("size-3 shrink-0", open && "rotate-90")} />
        <span className="flex-1 truncate">{group.label}</span>
        <span className="tabular-nums">{group.count}</span>
      </button>
      {open ? (
        group.count === 0 ? (
          <div className="flex items-center gap-2 py-1 pr-3 pl-8 text-xs text-muted-foreground/80">
            <span>{group.emptyLabel}</span>
            {onCreate ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex cursor-pointer items-center gap-0.5 text-primary hover:underline"
              >
                <PlusIcon className="size-3" />
                Create one
              </button>
            ) : null}
          </div>
        ) : (
          group.items.map((item) => (
            <ItemRow key={item.path} item={item} disabled={!canOpen} onOpen={onOpen} />
          ))
        )
      ) : null}
    </div>
  );
}

function ItemRow({
  item,
  disabled,
  onOpen,
}: {
  readonly item: CustomizationItem;
  readonly disabled: boolean;
  readonly onOpen: (path: string) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            onClick={() => onOpen(item.path)}
            className="flex h-6 w-full cursor-pointer items-center gap-1.5 py-0 pr-3 pl-8 text-left text-xs hover:bg-accent/50 disabled:cursor-default disabled:opacity-60"
          />
        }
      >
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <Badge size="sm" variant="outline">
          Claude
        </Badge>
        <Badge size="sm" variant={item.scope === "user" ? "info" : "secondary"}>
          {item.scope}
        </Badge>
      </TooltipTrigger>
      <TooltipPopup side="right">{item.description || item.name}</TooltipPopup>
    </Tooltip>
  );
}
