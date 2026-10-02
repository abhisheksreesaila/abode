import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import { collectLimitAccounts } from "@t3tools/shared/usageLimits";
import { useNavigate, useParams } from "@tanstack/react-router";
import { GitBranchIcon, PanelRightIcon, SquareTerminalIcon } from "lucide-react";
import { memo, useEffect, useMemo, type ComponentProps } from "react";

import { openCommandPalette } from "../../commandPaletteBus";
import { useNowMinute } from "../../hooks/useNowMinute";
import { shortcutLabelForCommand } from "../../keybindings";
import { cn } from "../../lib/utils";
import { requestPanelToggle } from "../../panelToggleBus";
import { selectThreadRightPanelState, useRightPanelStore } from "../../rightPanelStore";
import { useEnvironments } from "../../state/environments";
import { useProject, useThreadShell } from "../../state/entities";
import { environmentPresentations } from "../../state/presentation";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { requestComposerControl, useStatusBarStore } from "../../statusBarStore";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../../terminalUiStateStore";
import { resolveThreadRouteRef } from "../../threadRoutes";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { pickClosestWindow } from "../sidebar/usageStatus";
import {
  formatContextStatus,
  formatProjectHost,
  formatUsageStatus,
  needsYouLabel,
  runningLabel,
} from "./statusBar.logic";
import { useStatusBarCounts } from "./statusBarCounts";

const ITEM_CLASS =
  "inline-flex h-full shrink-0 items-center gap-1 px-2 whitespace-nowrap transition-colors";
const BUTTON_CLASS = cn(
  ITEM_CLASS,
  "cursor-pointer hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
);

function StatusBarButton({
  className,
  tooltip,
  ...props
}: ComponentProps<"button"> & { readonly className?: string; readonly tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className={cn(BUTTON_CLASS, className)} {...props} />}
      />
      <TooltipPopup side="top">{tooltip}</TooltipPopup>
    </Tooltip>
  );
}

const ActivityCounts = memo(function ActivityCounts() {
  const { running, needsYou } = useStatusBarCounts();
  return (
    <>
      <span className={cn(ITEM_CLASS, "text-success-foreground")} data-status-bar-running>
        <span aria-hidden className="size-1.5 rounded-xs bg-current" />
        {runningLabel(running)}
      </span>
      {needsYou > 0 ? (
        <span className={cn(ITEM_CLASS, "text-warning-foreground")} data-status-bar-needs-you>
          <span aria-hidden>⚠</span>
          {needsYouLabel(needsYou)}
        </span>
      ) : null}
    </>
  );
});

/** Quota nearest its limit, the same window the sidebar's usage row leads with. */
const UsageStatusButton = memo(function UsageStatusButton() {
  const navigate = useNavigate();
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const label = useMemo(
    () => formatUsageStatus(pickClosestWindow(collectLimitAccounts(presentations), now)),
    [presentations, now],
  );
  if (label === null) return null;
  return (
    <StatusBarButton
      aria-label="Usage limits"
      tooltip="Usage limits"
      onClick={() => void navigate({ to: "/usage" })}
    >
      {label}
    </StatusBarButton>
  );
});

/**
 * The 22px bar at the foot of the app window (abode F-030). Everything on it
 * comes from data the shell already holds, and an item with no data is left
 * out rather than faked. It is hidden at phone widths, where the toggles it
 * hosts live in the header.
 */
export const AppStatusBar = memo(function AppStatusBar() {
  const threadRef = useParams({
    strict: false,
    select: (params) => resolveThreadRouteRef(params),
  });
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const { environments } = useEnvironments();
  const shell = useThreadShell(threadRef);
  const project = useProject(shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null);
  const threadKey = threadRef ? scopedThreadKey(threadRef) : null;
  const info = useStatusBarStore((state) =>
    state.info !== null && state.info.threadKey === threadKey ? state.info : null,
  );
  const terminalOpen = useTerminalUiStateStore(
    (state) =>
      selectThreadTerminalUiState(state.terminalUiStateByThreadKey, threadRef).terminalOpen,
  );
  const rightPanelOpen = useRightPanelStore(
    (state) => selectThreadRightPanelState(state.byThreadKey, threadRef).isOpen,
  );

  // The reserved height lives in a CSS variable so the sidebar and every route's
  // full-height shell can shrink by it; it is set only while the bar is mounted.
  useEffect(() => {
    document.documentElement.dataset.statusBar = "on";
    return () => {
      delete document.documentElement.dataset.statusBar;
    };
  }, []);

  const hostLabel = shell
    ? (environments.find((environment) => environment.environmentId === shell.environmentId)
        ?.label ?? null)
    : null;
  const projectHost = formatProjectHost(project?.title ?? null, hostLabel);
  const branch = shell?.branch ?? null;
  const contextLabel = info ? formatContextStatus(info.contextPercent) : null;
  const terminalShortcut = shortcutLabelForCommand(keybindings, "terminal.toggle");
  const rightPanelShortcut = shortcutLabelForCommand(keybindings, "rightPanel.toggle");
  const paletteShortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle") ?? "⌘K";

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-20 hidden h-[var(--status-bar-height)] items-stretch overflow-hidden border-t border-border bg-sidebar text-xs text-muted-foreground md:flex"
      data-app-status-bar=""
      aria-label="Status bar"
    >
      {branch ? (
        <StatusBarButton
          aria-label={`Branch ${branch}`}
          tooltip="Change branch"
          onClick={() => requestComposerControl("workspace")}
          style={{ color: "var(--chip-blue-fg)" }}
        >
          <GitBranchIcon aria-hidden className="size-3" />
          <span className="max-w-48 truncate">{branch}</span>
        </StatusBarButton>
      ) : null}
      {projectHost ? (
        <span className={cn(ITEM_CLASS, "min-w-0 truncate")}>{projectHost}</span>
      ) : null}
      <ActivityCounts />
      <span className="flex-1" />
      <StatusBarButton
        aria-label="Toggle terminal"
        aria-pressed={terminalOpen}
        disabled={threadRef === null}
        tooltip={`Toggle terminal${terminalShortcut ? ` (${terminalShortcut})` : ""}`}
        className={cn(
          terminalOpen && "text-foreground",
          "disabled:cursor-default disabled:opacity-50",
        )}
        onClick={() => requestPanelToggle("terminal")}
      >
        <SquareTerminalIcon aria-hidden className="size-3.5" />
      </StatusBarButton>
      <StatusBarButton
        aria-label="Toggle side panel"
        aria-pressed={rightPanelOpen}
        disabled={threadRef === null}
        tooltip={`Toggle side panel${rightPanelShortcut ? ` (${rightPanelShortcut})` : ""}`}
        className={cn(
          rightPanelOpen && "text-foreground",
          "disabled:cursor-default disabled:opacity-50",
        )}
        onClick={() => requestPanelToggle("rightPanel")}
      >
        <PanelRightIcon aria-hidden className="size-3.5" />
      </StatusBarButton>
      {info?.modelLabel ? (
        <StatusBarButton
          aria-label={`Model ${info.modelLabel}`}
          tooltip="Change model"
          className="text-info-foreground"
          onClick={() => requestComposerControl("model")}
        >
          {info.modelLabel}
        </StatusBarButton>
      ) : null}
      {contextLabel ? <span className={ITEM_CLASS}>{contextLabel}</span> : null}
      <UsageStatusButton />
      <StatusBarButton
        aria-label="Open command palette"
        tooltip="Command palette"
        onClick={() => openCommandPalette()}
      >
        {paletteShortcut}
      </StatusBarButton>
    </footer>
  );
});
