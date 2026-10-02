import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  ChevronDownIcon,
  FolderGit2Icon,
  FolderGitIcon,
  FolderIcon,
  GitBranchIcon,
  ScaleIcon,
} from "lucide-react";
import { type Ref, memo, useImperativeHandle, useCallback, useMemo, useRef } from "react";

import { useComposerDraftStore, type DraftId } from "../composerDraftStore";
import { EnvironmentMachineIcon } from "./EnvironmentMachineIcon";
import { useProject, useThreadShell, useThreadShellsForProjectRefs } from "../state/entities";
import {
  type EnvMode,
  type EnvironmentOption,
  resolveCurrentWorkspaceLabel,
  resolveEnvModeLabel,
  resolveLockedWorkspaceLabel,
  resolvePreviousWorktreeLabel,
  resolvePreviousWorktreeSeed,
  shouldShowEnvironmentIndicator,
} from "./BranchToolbar.logic";
import {
  BranchToolbarBranchSelector,
  type BranchToolbarBranchSelectorHandle,
} from "./BranchToolbarBranchSelector";
import { BranchToolbarEnvironmentSelector } from "./BranchToolbarEnvironmentSelector";
import { BranchToolbarEnvModeSelector } from "./BranchToolbarEnvModeSelector";
import { PreviousWorktreeItemContent } from "./PreviousWorktreeItemContent";
import { ComposerControl } from "./chat/ComposerControl";
import { CHIP_TINT_CLASS_NAMES, resolveWorkspaceTint } from "./chat/chipTint";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { MiddleTruncate } from "./ui/middle-truncate";
import { useRunAfterComposerMenuClose } from "./chat/CompactComposerControlsMenu";
import { useComposerMenuProps } from "./chat/composerEventScope";
import { cn } from "~/lib/utils";

export interface BranchToolbarHandle {
  openBranchPicker: () => void;
  usePreviousWorktree: () => void;
}

interface BranchToolbarProps {
  forceNewWorktree?: boolean;
  ref?: Ref<BranchToolbarHandle>;
  environmentId: EnvironmentId;
  threadId: ThreadId;
  showGitControls: boolean;
  draftId?: DraftId;
  onEnvModeChange: (mode: EnvMode) => void;
  /** The thread's env mode as ChatView resolves it. */
  envMode: EnvMode;
  activeThreadBranchOverride?: string | null;
  onActiveThreadBranchOverrideChange?: (branch: string | null) => void;
  startFromOrigin: boolean;
  onStartFromOriginChange: (startFromOrigin: boolean) => void;
  autoEnvironmentLabel?: string | undefined;
  onAutoEnvironment?: (() => void) | undefined;
  envLocked: boolean;
  onCheckoutPullRequestRequest?: (reference: string) => void;
  onComposerFocusRequest?: () => void;
  availableEnvironments?: readonly EnvironmentOption[];
  onEnvironmentChange?: (environmentId: EnvironmentId) => void;
}

interface MobileRunContextSelectorProps {
  forceNewWorktree: boolean;
  autoEnvironmentLabel?: string | undefined;
  onAutoEnvironment?: (() => void) | undefined;
  envLocked: boolean;
  envModeLocked: boolean;
  environmentId: EnvironmentId;
  availableEnvironments: readonly EnvironmentOption[] | undefined;
  showEnvironmentPicker: boolean;
  showEnvironmentIndicator: boolean;
  onEnvironmentChange: ((environmentId: EnvironmentId) => void) | undefined;
  effectiveEnvMode: EnvMode;
  activeWorktreePath: string | null;
  onEnvModeChange: (mode: EnvMode) => void;
  previousWorktreeLabel: string | null;
  previousWorktreeBranch: string | null;
  onUsePreviousWorktree: () => void;
}

type RunContextMenuGroupsProps = Omit<MobileRunContextSelectorProps, "showEnvironmentIndicator"> & {
  /** Off when the thread has no workspace to switch (a non-Git project). */
  showWorkspace: boolean;
};

/** The "Run on" and "Workspace" radio groups, in the merged chip's popup and the footer's more menu. */
function RunContextMenuGroups({
  forceNewWorktree,
  autoEnvironmentLabel,
  onAutoEnvironment,
  envLocked,
  envModeLocked,
  environmentId,
  availableEnvironments,
  showEnvironmentPicker,
  showWorkspace,
  onEnvironmentChange,
  effectiveEnvMode,
  activeWorktreePath,
  onEnvModeChange,
  previousWorktreeLabel,
  previousWorktreeBranch,
  onUsePreviousWorktree,
}: RunContextMenuGroupsProps) {
  return (
    <>
      {showEnvironmentPicker && availableEnvironments && onEnvironmentChange ? (
        <>
          <MenuGroup>
            <MenuGroupLabel>Run on</MenuGroupLabel>
            <MenuRadioGroup
              value={autoEnvironmentLabel ? "auto" : environmentId}
              onValueChange={(value) =>
                value === "auto"
                  ? onAutoEnvironment?.()
                  : onEnvironmentChange(value as EnvironmentId)
              }
            >
              {onAutoEnvironment && (
                <MenuRadioItem
                  value="auto"
                  disabled={envLocked}
                  closeOnClick
                  onClick={() => {
                    if (autoEnvironmentLabel) onAutoEnvironment?.();
                  }}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ScaleIcon className="size-3" aria-hidden="true" />
                    <span className="min-w-0 truncate">
                      {autoEnvironmentLabel ?? "Auto balance"}
                    </span>
                  </span>
                </MenuRadioItem>
              )}
              {availableEnvironments.map((env) => (
                <MenuRadioItem
                  key={env.environmentId}
                  disabled={envLocked}
                  value={env.environmentId}
                  closeOnClick
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <EnvironmentMachineIcon kind={env.machine} className="size-3" />
                    <span className="min-w-0 truncate">{env.label}</span>
                  </span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
          {showWorkspace ? <MenuSeparator /> : null}
        </>
      ) : null}
      {showWorkspace ? (
        <MenuGroup>
          <MenuGroupLabel>Workspace</MenuGroupLabel>
          <MenuRadioGroup
            value={effectiveEnvMode}
            onValueChange={(value) => {
              if (value === "previous-worktree") {
                onUsePreviousWorktree();
                return;
              }
              onEnvModeChange(value as EnvMode);
            }}
          >
            <MenuRadioItem disabled={envModeLocked || forceNewWorktree} value="local" closeOnClick>
              <span className="flex min-w-0 items-center gap-1.5">
                {activeWorktreePath ? (
                  <FolderGitIcon className="size-3" />
                ) : (
                  <FolderIcon className="size-3" />
                )}
                <MiddleTruncate value={resolveCurrentWorkspaceLabel(activeWorktreePath)} />
              </span>
            </MenuRadioItem>
            <MenuRadioItem disabled={envModeLocked} value="worktree" closeOnClick>
              <span className="flex min-w-0 items-center gap-1.5">
                <FolderGit2Icon className="size-3" />
                <span className="min-w-0 truncate">{resolveEnvModeLabel("worktree")}</span>
              </span>
            </MenuRadioItem>
            {previousWorktreeLabel ? (
              <MenuRadioItem disabled={envModeLocked} value="previous-worktree" closeOnClick>
                <PreviousWorktreeItemContent branch={previousWorktreeBranch} />
              </MenuRadioItem>
            ) : null}
          </MenuRadioGroup>
        </MenuGroup>
      ) : null}
    </>
  );
}

const MobileRunContextSelector = memo(function MobileRunContextSelector({
  forceNewWorktree,
  autoEnvironmentLabel,
  onAutoEnvironment,
  envLocked,
  envModeLocked,
  environmentId,
  availableEnvironments,
  showEnvironmentPicker,
  showEnvironmentIndicator,
  onEnvironmentChange,
  effectiveEnvMode,
  activeWorktreePath,
  onEnvModeChange,
  previousWorktreeLabel,
  previousWorktreeBranch,
  onUsePreviousWorktree,
}: MobileRunContextSelectorProps) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const activeEnvironment = useMemo(
    () => availableEnvironments?.find((env) => env.environmentId === environmentId) ?? null,
    [availableEnvironments, environmentId],
  );
  const WorkspaceIcon =
    effectiveEnvMode === "worktree"
      ? FolderGit2Icon
      : activeWorktreePath
        ? FolderGitIcon
        : FolderIcon;
  const workspaceLabel = forceNewWorktree
    ? resolveEnvModeLabel("worktree")
    : envModeLocked
      ? resolveLockedWorkspaceLabel(activeWorktreePath, effectiveEnvMode)
      : effectiveEnvMode === "worktree"
        ? resolveEnvModeLabel("worktree")
        : resolveCurrentWorkspaceLabel(activeWorktreePath);
  const isLocked = envLocked || envModeLocked;
  const workspaceTint = resolveWorkspaceTint(
    effectiveEnvMode === "worktree" || activeWorktreePath !== null,
  );
  const workspaceIcon = (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
        <WorkspaceIcon className={cn("size-3 shrink-0", showEnvironmentIndicator && "mx-0!")} />
      </TooltipTrigger>
      <TooltipPopup>{workspaceLabel}</TooltipPopup>
    </Tooltip>
  );
  const icon = showEnvironmentIndicator ? (
    // Button's base styles apply `-mx-0.5` to descendant SVGs, which eats 4px
    // out of whatever gap we set. mx-0! cancels that so gap-0.5 reads as 2px.
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
          {autoEnvironmentLabel ? (
            <ScaleIcon className="size-3 shrink-0 mx-0!" aria-hidden="true" />
          ) : (
            <EnvironmentMachineIcon
              kind={activeEnvironment?.machine ?? "server"}
              className="size-3 shrink-0 mx-0!"
            />
          )}
        </TooltipTrigger>
        <TooltipPopup>{autoEnvironmentLabel ?? activeEnvironment?.label ?? "Run on"}</TooltipPopup>
      </Tooltip>
      {workspaceIcon}
    </span>
  ) : (
    workspaceIcon
  );
  const triggerContent = (
    <>
      {icon}
      <span data-composer-control-label className="min-w-0 max-w-40">
        <span className="block w-full min-w-0 max-w-40 truncate">
          {autoEnvironmentLabel ??
            (showEnvironmentIndicator ? (activeEnvironment?.label ?? "Run on") : workspaceLabel)}
        </span>
      </span>
    </>
  );

  if (isLocked) {
    return (
      <span
        className={cn(
          "inline-flex h-7 min-w-0 flex-initial items-center justify-start gap-1 rounded-md border border-transparent px-1.75 font-normal text-muted-foreground/70 text-xs sm:h-6",
          CHIP_TINT_CLASS_NAMES[workspaceTint],
        )}
        data-composer-context-control
      >
        {triggerContent}
      </span>
    );
  }

  return (
    <Menu>
      <MenuTrigger
        render={<ComposerControl size="xs" tint={workspaceTint} />}
        className="min-w-0 flex-initial justify-start"
        data-composer-context-control
        data-composer-shortcut={[
          showEnvironmentPicker && !envLocked ? "composer.host" : "",
          !envModeLocked ? "composer.workspace" : "",
        ].join(" ")}
      >
        {triggerContent}
        <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
      </MenuTrigger>
      <MenuPopup
        align="start"
        side="top"
        className={previousWorktreeLabel ? "w-[min(21rem,calc(100vw-2rem))]" : undefined}
        {...composerFloatingLayerProps}
      >
        <RunContextMenuGroups
          forceNewWorktree={forceNewWorktree}
          autoEnvironmentLabel={autoEnvironmentLabel}
          onAutoEnvironment={onAutoEnvironment}
          envLocked={envLocked}
          envModeLocked={envModeLocked}
          environmentId={environmentId}
          availableEnvironments={availableEnvironments}
          showEnvironmentPicker={showEnvironmentPicker}
          showWorkspace
          onEnvironmentChange={onEnvironmentChange}
          effectiveEnvMode={effectiveEnvMode}
          activeWorktreePath={activeWorktreePath}
          onEnvModeChange={onEnvModeChange}
          previousWorktreeLabel={previousWorktreeLabel}
          previousWorktreeBranch={previousWorktreeBranch}
          onUsePreviousWorktree={onUsePreviousWorktree}
        />
      </MenuPopup>
    </Menu>
  );
});

/**
 * Everything the chips and the overflow menu both derive from the thread:
 * where it runs, whether its workspace is pinned, and which earlier worktree
 * a draft could hop into.
 */
function useBranchToolbarModel({
  forceNewWorktree = false,
  environmentId,
  threadId,
  draftId,
  envMode,
  envLocked,
  availableEnvironments,
  onEnvironmentChange,
  activeThreadBranchOverride,
}: BranchToolbarProps) {
  const threadRef = useMemo(
    () => scopeThreadRef(environmentId, threadId),
    [environmentId, threadId],
  );
  const draftThread = useComposerDraftStore((store) =>
    draftId ? store.getDraftSession(draftId) : store.getDraftThreadByRef(threadRef),
  );
  const serverThread = useThreadShell(threadRef);
  const setDraftThreadContext = useComposerDraftStore((store) => store.setDraftThreadContext);
  const activeProjectRef = serverThread
    ? scopeProjectRef(serverThread.environmentId, serverThread.projectId)
    : draftThread
      ? scopeProjectRef(draftThread.environmentId, draftThread.projectId)
      : null;
  const activeProject = useProject(activeProjectRef);
  const ready = (serverThread !== null || draftThread !== null) && activeProject !== null;
  const activeWorktreePath = forceNewWorktree
    ? null
    : (serverThread?.worktreePath ?? draftThread?.worktreePath ?? null);
  const effectiveEnvMode = forceNewWorktree ? "worktree" : envMode;
  const envModeLocked = envLocked || (serverThread !== null && activeWorktreePath !== null);
  const branchLabel =
    activeThreadBranchOverride !== undefined
      ? activeThreadBranchOverride
      : (serverThread?.branch ?? draftThread?.branch ?? null);

  // "Previous worktree" hops a draft into the most recently active worktree
  // of this project — the "keep going where I just was" follow-up flow. Only
  // drafts can hop; started server threads have their workspace pinned.
  const canUsePreviousWorktree =
    draftThread !== null && serverThread === null && !envModeLocked && !forceNewWorktree;
  const projectRefsForWorktreeLookup = useMemo(
    () => (canUsePreviousWorktree && activeProjectRef ? [activeProjectRef] : []),
    [canUsePreviousWorktree, activeProjectRef],
  );
  const projectThreads = useThreadShellsForProjectRefs(projectRefsForWorktreeLookup);
  const previousWorktreeSeed = useMemo(
    () =>
      canUsePreviousWorktree
        ? resolvePreviousWorktreeSeed({
            threads: projectThreads,
            currentWorktreePath: activeWorktreePath,
          })
        : null,
    [activeWorktreePath, canUsePreviousWorktree, projectThreads],
  );
  const previousWorktreeLabel = previousWorktreeSeed
    ? resolvePreviousWorktreeLabel(previousWorktreeSeed)
    : null;
  const onUsePreviousWorktree = useCallback(() => {
    if (!previousWorktreeSeed || !activeProjectRef) return;
    // Same shape the branch selector writes when picking a branch that
    // already lives in a worktree: point the draft at the existing tree.
    setDraftThreadContext(draftId ?? threadRef, {
      branch: previousWorktreeSeed.branch,
      worktreePath: previousWorktreeSeed.worktreePath,
      envMode: "worktree",
      projectRef: activeProjectRef,
    });
  }, [activeProjectRef, draftId, previousWorktreeSeed, setDraftThreadContext, threadRef]);

  const showEnvironmentPicker = Boolean(
    availableEnvironments && availableEnvironments.length > 1 && onEnvironmentChange,
  );
  const activeEnvironmentOption =
    availableEnvironments?.find((env) => env.environmentId === environmentId) ?? null;
  const showEnvironmentIndicator = shouldShowEnvironmentIndicator({
    activeEnvironment: activeEnvironmentOption,
    canPickEnvironment: showEnvironmentPicker,
  });

  return {
    ready,
    branchLabel,
    activeWorktreePath,
    effectiveEnvMode,
    envModeLocked,
    canUsePreviousWorktree,
    previousWorktreeSeed,
    previousWorktreeLabel,
    onUsePreviousWorktree,
    showEnvironmentPicker,
    showEnvironmentIndicator,
    activeEnvironmentOption,
  };
}

/**
 * The thread's workspace controls as compact chips: where it runs, the
 * workspace mode and the branch. The composer places this in its footer as one
 * block, so it moves into the footer's "more" menu (see
 * `BranchToolbarOverflowItems`) when the footer is too narrow.
 */
export const BranchToolbar = memo(function BranchToolbar(props: BranchToolbarProps) {
  const {
    forceNewWorktree = false,
    ref,
    environmentId,
    threadId,
    showGitControls,
    draftId,
    onEnvModeChange,
    activeThreadBranchOverride,
    onActiveThreadBranchOverrideChange,
    startFromOrigin,
    onStartFromOriginChange,
    autoEnvironmentLabel,
    onAutoEnvironment,
    envLocked,
    onCheckoutPullRequestRequest,
    onComposerFocusRequest,
    availableEnvironments,
    onEnvironmentChange,
  } = props;
  const branchSelectorRef = useRef<BranchToolbarBranchSelectorHandle>(null);
  const model = useBranchToolbarModel(props);
  const { canUsePreviousWorktree, previousWorktreeSeed, onUsePreviousWorktree } = model;

  useImperativeHandle(
    ref,
    () => ({
      openBranchPicker: () => branchSelectorRef.current?.open(),
      usePreviousWorktree: () => {
        if (!showGitControls || !canUsePreviousWorktree || !previousWorktreeSeed) return;
        onUsePreviousWorktree();
        onComposerFocusRequest?.();
      },
    }),
    [
      canUsePreviousWorktree,
      onComposerFocusRequest,
      onUsePreviousWorktree,
      previousWorktreeSeed,
      showGitControls,
    ],
  );

  if (!model.ready) return null;

  return (
    <div
      data-composer-context-chips="true"
      className="flex min-w-0 items-center gap-1 text-xs font-normal text-muted-foreground/70"
    >
      {showGitControls ? (
        <div className="contents @3xl/composer-surface:hidden">
          <MobileRunContextSelector
            forceNewWorktree={forceNewWorktree}
            autoEnvironmentLabel={autoEnvironmentLabel}
            onAutoEnvironment={onAutoEnvironment}
            envLocked={envLocked}
            envModeLocked={model.envModeLocked}
            environmentId={environmentId}
            availableEnvironments={availableEnvironments}
            showEnvironmentPicker={model.showEnvironmentPicker}
            showEnvironmentIndicator={model.showEnvironmentIndicator}
            onEnvironmentChange={onEnvironmentChange}
            effectiveEnvMode={model.effectiveEnvMode}
            activeWorktreePath={model.activeWorktreePath}
            onEnvModeChange={onEnvModeChange}
            previousWorktreeLabel={model.previousWorktreeLabel}
            previousWorktreeBranch={model.previousWorktreeSeed?.branch ?? null}
            onUsePreviousWorktree={model.onUsePreviousWorktree}
          />
        </div>
      ) : null}
      {showGitControls || model.showEnvironmentIndicator ? (
        <div
          className={cn(
            "min-h-7 min-w-0 items-center gap-1 sm:min-h-6",
            showGitControls ? "hidden @3xl/composer-surface:flex" : "flex",
          )}
        >
          {model.showEnvironmentIndicator && availableEnvironments && (
            <>
              <BranchToolbarEnvironmentSelector
                autoEnvironmentLabel={autoEnvironmentLabel}
                onAutoEnvironment={onAutoEnvironment}
                envLocked={envLocked}
                environmentId={environmentId}
                availableEnvironments={availableEnvironments}
                {...(model.showEnvironmentPicker && onEnvironmentChange
                  ? { onEnvironmentChange }
                  : {})}
              />
              {showGitControls ? (
                <Separator
                  orientation="vertical"
                  className="mx-0.5 h-3.5!"
                  data-composer-context-control
                />
              ) : null}
            </>
          )}
          {showGitControls ? (
            <BranchToolbarEnvModeSelector
              forceNewWorktree={forceNewWorktree}
              envLocked={model.envModeLocked}
              effectiveEnvMode={model.effectiveEnvMode}
              activeWorktreePath={model.activeWorktreePath}
              onEnvModeChange={onEnvModeChange}
              previousWorktreeLabel={model.previousWorktreeLabel}
              previousWorktreeBranch={model.previousWorktreeSeed?.branch ?? null}
              onUsePreviousWorktree={model.onUsePreviousWorktree}
            />
          ) : null}
        </div>
      ) : null}

      {showGitControls ? (
        <BranchToolbarBranchSelector
          forceNewWorktree={forceNewWorktree}
          ref={branchSelectorRef}
          className="min-w-0 flex-initial"
          environmentId={environmentId}
          threadId={threadId}
          {...(draftId ? { draftId } : {})}
          envLocked={envLocked}
          effectiveEnvModeOverride={model.effectiveEnvMode}
          {...(activeThreadBranchOverride !== undefined ? { activeThreadBranchOverride } : {})}
          {...(onActiveThreadBranchOverrideChange ? { onActiveThreadBranchOverrideChange } : {})}
          startFromOrigin={startFromOrigin}
          onStartFromOriginChange={onStartFromOriginChange}
          {...(onCheckoutPullRequestRequest ? { onCheckoutPullRequestRequest } : {})}
          {...(onComposerFocusRequest ? { onComposerFocusRequest } : {})}
        />
      ) : null}
    </div>
  );
});

/**
 * The same controls as menu entries, for the footer's "more" menu when the
 * chips no longer fit. The branch entry hands over to the branch picker, which
 * stays mounted in the hidden chips.
 */
export const BranchToolbarOverflowItems = memo(function BranchToolbarOverflowItems(
  props: BranchToolbarProps & { onOpenBranchPicker: () => void },
) {
  const {
    forceNewWorktree = false,
    showGitControls,
    onEnvModeChange,
    autoEnvironmentLabel,
    onAutoEnvironment,
    envLocked,
    environmentId,
    availableEnvironments,
    onEnvironmentChange,
    onOpenBranchPicker,
  } = props;
  const model = useBranchToolbarModel(props);
  const runAfterMenuClose = useRunAfterComposerMenuClose();
  if (!model.ready) return null;

  return (
    <>
      {model.showEnvironmentPicker || showGitControls ? (
        <RunContextMenuGroups
          forceNewWorktree={forceNewWorktree}
          autoEnvironmentLabel={autoEnvironmentLabel}
          onAutoEnvironment={onAutoEnvironment}
          envLocked={envLocked}
          envModeLocked={model.envModeLocked}
          environmentId={environmentId}
          availableEnvironments={availableEnvironments}
          showEnvironmentPicker={model.showEnvironmentPicker}
          showWorkspace={showGitControls}
          onEnvironmentChange={onEnvironmentChange}
          effectiveEnvMode={model.effectiveEnvMode}
          activeWorktreePath={model.activeWorktreePath}
          onEnvModeChange={onEnvModeChange}
          previousWorktreeLabel={model.previousWorktreeLabel}
          previousWorktreeBranch={model.previousWorktreeSeed?.branch ?? null}
          onUsePreviousWorktree={model.onUsePreviousWorktree}
        />
      ) : model.showEnvironmentIndicator ? (
        <MenuGroup>
          <MenuGroupLabel>Run on</MenuGroupLabel>
          <MenuItem disabled>{model.activeEnvironmentOption?.label ?? "Run on"}</MenuItem>
        </MenuGroup>
      ) : null}
      {showGitControls ? (
        <>
          <MenuSeparator />
          <MenuGroup>
            <MenuGroupLabel>Branch</MenuGroupLabel>
            <MenuItem
              // Open the picker once the menu has finished closing, or the
              // closing menu's outside-press handling dismisses it.
              onClick={() => runAfterMenuClose(onOpenBranchPicker)}
            >
              <GitBranchIcon className="size-3" />
              <MiddleTruncate value={model.branchLabel ?? "Switch branch"} />
            </MenuItem>
          </MenuGroup>
        </>
      ) : null}
    </>
  );
});
