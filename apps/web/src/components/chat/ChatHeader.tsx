import {
  type EnvironmentId,
  type EditorId,
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type ThreadId,
} from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { EllipsisIcon, GitCompareIcon } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import GitActionsControl from "../GitActionsControl";
import { type DraftId } from "~/composerDraftStore";
import { toastManager } from "../ui/toast";
import ProjectScriptsControl, {
  type NewProjectScriptInput,
  type ProjectScriptActionResult,
} from "../ProjectScriptsControl";
import { OpenInPicker } from "./OpenInPicker";
import { HeaderNavControls } from "./HeaderNavControls";
import { TopBarAccountControls, TopBarAccountMenuItems } from "./TopBarAccountControls";
import { usePullRequestsSupported } from "../../hooks/usePullRequestsSupported";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { TranscriptModeMenuItems } from "./TranscriptModeMenuItems";
import { useRemoteOpenState, type RemoteOpenMode } from "../../remoteOpen";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useT3ProjectFileScripts } from "~/hooks/useT3ProjectFileScripts";
import { useThreadActionMenu } from "~/hooks/useThreadActionMenu";
import { readLocalApi } from "~/localApi";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { TitleSearchBox } from "./TitleSearchBox";
import { cn } from "~/lib/utils";
import { useIsMobile } from "~/hooks/useMediaQuery";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuItemLabel, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { useRightPanelStore } from "../../rightPanelStore";
import { CoffeeStatus } from "../../delights/Delights";

interface ChatHeaderProps {
  activeThreadEnvironmentId: EnvironmentId;
  activeThreadId: ThreadId;
  draftId?: DraftId;
  activeThreadTitle: string;
  /** Drafts have no server thread yet, so the title carries no action menu. */
  isServerThread: boolean;
  activeProject: EnvironmentProject | null;
  openInCwd: string | null;
  activeProjectScripts: ReadonlyArray<ProjectScript> | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  rightPanelOpen: boolean;
  gitCwd: string | null;
  readonly onOpenPullRequest?: ((number: number) => void) | undefined;
  onOpenProjectSettings?: (() => void) | undefined;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<ProjectScriptActionResult>;
  onUpdateProjectScript: (
    scriptId: string,
    input: NewProjectScriptInput,
  ) => Promise<ProjectScriptActionResult>;
  onDeleteProjectScript: (scriptId: string) => Promise<ProjectScriptActionResult>;
}

/**
 * Rename commit rule shared with the sidebar's inline rename: trim, reject
 * empty (the caller toasts), and skip the mutation when nothing changed.
 */
export function resolveRenameCommit(input: {
  readonly title: string;
  readonly originalTitle: string;
}): { action: "commit"; title: string } | { action: "reject-empty" } | { action: "noop" } {
  const trimmed = input.title.trim();
  if (trimmed.length === 0) return { action: "reject-empty" };
  if (trimmed === input.originalTitle) return { action: "noop" };
  return { action: "commit", title: trimmed };
}

/**
 * Where the header's run and open-in-editor controls live. The toolbar copies
 * stay mounted at every width (CSS hides them when narrow) so an open dialog
 * never loses state; the ⋯ menu copies carry the narrow layout. Exactly one
 * OpenInPicker owns the open-in-editor keyboard shortcut.
 */
export function resolveHeaderControlPlacement(actionsCollapsed: boolean) {
  return {
    toolbarHidden: actionsCollapsed,
    toolbarOwnsShortcut: !actionsCollapsed,
    menuOwnsShortcut: actionsCollapsed,
    scriptsMenuPresentation: actionsCollapsed ? ("menu" as const) : ("manage" as const),
  };
}

export function shouldShowOpenInPicker(input: {
  readonly activeProjectName: string | undefined;
  readonly activeThreadEnvironmentId: EnvironmentId;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly remoteOpenMode: RemoteOpenMode;
}): boolean {
  if (!input.activeProjectName) return false;
  if (
    input.primaryEnvironmentId !== null &&
    input.activeThreadEnvironmentId === input.primaryEnvironmentId
  ) {
    return true;
  }
  // Remote environments get the picker in deep-link mode (or its explicit
  // "no SSH route" state). Non-primary local backends (e.g. WSL) keep it
  // hidden, matching pre-remote behavior.
  return input.remoteOpenMode !== "local-exec";
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadEnvironmentId,
  activeThreadId,
  draftId,
  activeThreadTitle,
  isServerThread,
  activeProject,
  openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  availableEditors,
  rightPanelOpen,
  gitCwd,
  onOpenPullRequest,
  onOpenProjectSettings,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
}: ChatHeaderProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  // Side panels can leave a desktop header narrower than a phone: below this the
  // run and open-in-editor buttons fold into the ⋯ menu.
  const [isNarrowHeader, setIsNarrowHeader] = useState(false);
  useEffect(() => {
    const container = headerRef.current;
    if (!container) return;
    const update = () => setIsNarrowHeader(container.clientWidth < 512);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const actionsCollapsed = isMobile || isNarrowHeader;
  const [actionsOpen, setActionsOpen] = useState(false);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const activeProjectName = activeProject?.title;
  const activeProjectCwd = activeProject?.workspaceRoot ?? null;
  const fileScripts = useT3ProjectFileScripts(
    activeThreadEnvironmentId,
    activeProjectScripts ? activeProjectCwd : null,
  );
  const remoteOpenState = useRemoteOpenState(activeThreadEnvironmentId);
  const showOpenInPicker = shouldShowOpenInPicker({
    activeProjectName,
    activeThreadEnvironmentId,
    primaryEnvironmentId,
    remoteOpenMode: remoteOpenState.mode,
  });
  const activeThreadRef = useMemo(
    () => scopeThreadRef(activeThreadEnvironmentId, activeThreadId),
    [activeThreadEnvironmentId, activeThreadId],
  );
  const pullRequestsSupported = usePullRequestsSupported();
  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  // Inline rename, keyed by thread: navigating away drops an in-progress
  // rename instead of committing stale text. Cleared on thread change (not
  // just hidden) so returning to the thread doesn't revive the old draft.
  const [renaming, setRenaming] = useState<{ threadId: ThreadId; title: string } | null>(null);
  if (renaming !== null && renaming.threadId !== activeThreadId) {
    setRenaming(null);
  }
  const renamingTitle = renaming?.threadId === activeThreadId ? renaming.title : null;
  const renameCommittedRef = useRef(false);
  const startRename = useCallback(() => {
    renameCommittedRef.current = false;
    setRenaming({ threadId: activeThreadId, title: activeThreadTitle });
  }, [activeThreadId, activeThreadTitle]);
  const commitRename = useCallback(
    (title: string) => {
      setRenaming(null);
      const resolution = resolveRenameCommit({ title, originalTitle: activeThreadTitle });
      if (resolution.action === "reject-empty") {
        toastManager.add({ type: "warning", title: "Thread title cannot be empty" });
        return;
      }
      if (resolution.action === "noop") return;
      void updateThreadMetadata({
        environmentId: activeThreadEnvironmentId,
        input: { threadId: activeThreadId, title: resolution.title },
      }).then((result) => {
        if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
          const error = squashAtomCommandFailure(result);
          toastManager.add({
            type: "error",
            title: "Failed to rename thread",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
      });
    },
    [activeThreadEnvironmentId, activeThreadId, activeThreadTitle, updateThreadMetadata],
  );
  const { openMenu } = useThreadActionMenu({
    threadRef: isServerThread ? activeThreadRef : null,
    projectCwd: activeProjectCwd,
    onStartRename: startRename,
  });
  const handleHeaderContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      if (renamingTitle !== null) return;
      // The right-side controls (git, scripts, open-in) keep their own
      // behavior; only the rest of the bar opens the thread menu.
      if ((event.target as HTMLElement).closest("[data-chat-header-actions]")) return;
      if (!isServerThread && onOpenProjectSettings === undefined) return;
      event.preventDefault();
      if (!isServerThread) {
        const api = readLocalApi();
        if (!api) return;
        void api.contextMenu
          .show([{ id: "project-settings", label: "Project settings", icon: "settings" }], {
            x: event.clientX,
            y: event.clientY,
          })
          .then((action) => {
            if (action === "project-settings") onOpenProjectSettings?.();
          });
        return;
      }
      openMenu({ x: event.clientX, y: event.clientY });
    },
    [isServerThread, onOpenProjectSettings, openMenu, renamingTitle],
  );
  const handleRenameKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        renameCommittedRef.current = true;
        commitRename(event.currentTarget.value);
      } else if (event.key === "Escape") {
        renameCommittedRef.current = true;
        setRenaming(null);
      }
    },
    [commitRename],
  );
  const placement = resolveHeaderControlPlacement(actionsCollapsed);
  const hasMenuContent = Boolean(activeProjectScripts || showOpenInPicker || gitCwd);
  return (
    <div
      ref={headerRef}
      className="@container/header-actions flex min-w-0 flex-1 items-center gap-2"
      onContextMenu={handleHeaderContextMenu}
    >
      <HeaderNavControls />
      {renamingTitle !== null ? (
        <input
          autoFocus
          aria-label="Thread title"
          className="h-7 min-w-0 max-w-xl flex-1 rounded-md bg-transparent px-2.5 text-sm font-medium text-foreground outline-none ring-1 ring-ring/50 focus:ring-ring [-webkit-app-region:no-drag]"
          defaultValue={renamingTitle}
          onBlur={(event) => {
            if (renameCommittedRef.current) return;
            commitRename(event.currentTarget.value);
          }}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={handleRenameKeyDown}
        />
      ) : (
        <div className="flex min-w-0 flex-1 justify-center">
          <TitleSearchBox projectName={activeProjectName ?? null} />
        </div>
      )}
      {/* The 3pm coffee lives here too: the status bar that also shows it is off by default. */}
      <CoffeeStatus />
      <div
        data-chat-header-actions
        className={cn(
          "flex shrink-0 items-center justify-end gap-1",
          // Reserve two panel toggles plus their 4px gaps and 1px edge inset.
          // The page header adds 8px more right padding at sm.
          rightPanelOpen ? "pr-0" : "pr-18.25 sm:pr-14.25",
          "[[data-panel-animations=true]_&]:motion-safe:transition-[padding-right] [[data-panel-animations=true]_&]:motion-safe:duration-(--panel-animation-duration) [[data-panel-animations=true]_&]:motion-safe:ease-out",
        )}
      >
        <div className={cn("flex items-center gap-1", placement.toolbarHidden && "hidden")}>
          {activeProjectScripts ? (
            <ProjectScriptsControl
              presentation="toolbar"
              compact
              scripts={activeProjectScripts}
              fileScripts={fileScripts}
              keybindings={keybindings}
              preferredScriptId={preferredScriptId}
              onRunScript={onRunProjectScript}
              onAddScript={onAddProjectScript}
              onUpdateScript={onUpdateProjectScript}
              onDeleteScript={onDeleteProjectScript}
            />
          ) : null}
          {showOpenInPicker ? (
            <OpenInPicker
              presentation="toolbar"
              compact
              enableShortcut={placement.toolbarOwnsShortcut}
              environmentId={activeThreadEnvironmentId}
              keybindings={keybindings}
              availableEditors={availableEditors}
              openInCwd={openInCwd}
            />
          ) : null}
        </div>
        <Menu open={actionsOpen} onOpenChange={setActionsOpen}>
          <MenuTrigger
            render={
              <Button size="icon-toolbar" variant="toolbar" aria-label="More header actions" />
            }
          >
            <EllipsisIcon className="size-4" />
          </MenuTrigger>
          {/* keepMounted: the action dialogs live inside these controls, so
              they must survive the menu closing. */}
          <MenuPopup keepMounted aria-label="Header actions" align="end">
            <TranscriptModeMenuItems />
            {actionsCollapsed ? <TopBarAccountMenuItems includePullRequests={false} /> : null}
            {pullRequestsSupported ? (
              <MenuItem
                onClick={() =>
                  useRightPanelStore.getState().open(activeThreadRef, "pull-request-list")
                }
              >
                <PullRequestGlyph.pullRequest className="size-4" />
                <MenuItemLabel>Pull requests</MenuItemLabel>
              </MenuItem>
            ) : null}
            {activeProjectName ? (
              <MenuItem
                onClick={() => useRightPanelStore.getState().open(activeThreadRef, "changes")}
              >
                <GitCompareIcon className="size-4" />
                <MenuItemLabel>Changes</MenuItemLabel>
              </MenuItem>
            ) : null}
            {hasMenuContent ? <MenuSeparator /> : null}
            {activeProjectScripts ? (
              <ProjectScriptsControl
                onRequestMenuClose={() => setActionsOpen(false)}
                presentation={placement.scriptsMenuPresentation}
                scripts={activeProjectScripts}
                fileScripts={fileScripts}
                keybindings={keybindings}
                preferredScriptId={preferredScriptId}
                onRunScript={onRunProjectScript}
                onAddScript={onAddProjectScript}
                onUpdateScript={onUpdateProjectScript}
                onDeleteScript={onDeleteProjectScript}
              />
            ) : null}
            {showOpenInPicker ? (
              <OpenInPicker
                presentation="menu"
                // One instance owns the keyboard shortcut: the toolbar's, unless folded away.
                enableShortcut={placement.menuOwnsShortcut}
                environmentId={activeThreadEnvironmentId}
                keybindings={keybindings}
                availableEditors={availableEditors}
                openInCwd={openInCwd}
              />
            ) : null}
            {activeProjectName && gitCwd ? (
              <GitActionsControl
                presentation="menu"
                gitCwd={gitCwd}
                activeThreadRef={scopeThreadRef(activeThreadEnvironmentId, activeThreadId)}
                onOpenPullRequest={onOpenPullRequest}
                {...(draftId ? { draftId } : {})}
              />
            ) : null}
          </MenuPopup>
        </Menu>
        {actionsCollapsed ? null : <TopBarAccountControls />}
      </div>
    </div>
  );
});
