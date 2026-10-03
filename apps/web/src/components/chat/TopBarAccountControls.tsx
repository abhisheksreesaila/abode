import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { collectLimitAccounts } from "@t3tools/shared/usageLimits";
import { EllipsisIcon, GaugeIcon, SettingsIcon, SmartphoneIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { shortcutLabelForCommand } from "../../keybindings";
import { cn } from "../../lib/utils";
import { useEnvironments } from "../../state/environments";
import { environmentPresentations } from "../../state/presentation";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import { accountTitle, UsageLimitsPanel } from "../usage/UsageLimitsPanel";
import {
  compactWindowLabel,
  formatResetAbsolute,
  pickClosestWindow,
  usageTone,
  type UsageTone,
} from "../sidebar/usageStatus";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuItemLabel, MenuPopup, MenuTrigger } from "../ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const BADGE_TONE: Record<UsageTone, string> = {
  ok: "text-muted-foreground",
  warn: "text-warning-foreground",
  critical: "text-destructive",
};

/** The same check the pull request page uses: one connected server offering them is enough. */
function usePullRequestsSupported() {
  const { environments } = useEnvironments();
  return environments.some(
    (environment) => environment.serverConfig?.environment.capabilities.pullRequests === true,
  );
}

/** Navigation shared by the top-bar icons and the phone's ⋯ menu entries. */
function useAccountNavigation() {
  const navigate = useNavigate();
  return {
    openPullRequests: () =>
      void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() }),
    openUsage: () => void navigate({ to: "/usage" }),
    openConnections: () => void navigate({ to: "/settings/connections" }),
    openSettings: () => void navigate({ to: "/settings" }),
  };
}

function ToolbarIconButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-toolbar"
            variant="toolbar"
            aria-label={props.label}
            onClick={props.onClick}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * The gauge with the closest limit's percent as a tiny badge. It reads the
 * limits the server already publishes and never polls. With nothing reported
 * yet the button goes straight to the usage page.
 */
const UsageToolbarButton = memo(function UsageToolbarButton({
  onOpenUsagePage,
}: {
  readonly onOpenUsagePage: () => void;
}) {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const accounts = useMemo(() => collectLimitAccounts(presentations), [presentations]);
  const closest = useMemo(() => pickClosestWindow(accounts, now), [accounts, now]);
  const hasWindows = accounts.some((account) => account.limits.windows.length > 0);
  const shortcut = shortcutLabelForCommand(keybindings, "usage.open");

  if (!hasWindows) {
    return (
      <ToolbarIconButton label="Usage" onClick={onOpenUsagePage}>
        <GaugeIcon />
      </ToolbarIconButton>
    );
  }

  const percent = closest ? Math.round(closest.window.usedPercent) : null;
  const tone = closest ? usageTone(closest.window.usedPercent) : "ok";
  const reset = closest?.window.resetsAt
    ? formatResetAbsolute(closest.window.resetsAt, now, timestampFormat)
    : null;
  const summary = closest
    ? [
        accountTitle(closest.account),
        `${percent}% of ${compactWindowLabel(closest.window)}`,
        reset ? `resets ${reset}` : null,
      ]
        .filter((part): part is string => part !== null && part.length > 0)
        .join(" · ")
    : "Usage limits";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  size="icon-toolbar"
                  variant="toolbar"
                  aria-label={percent === null ? "Usage limits" : `Usage limits, ${percent}% used`}
                  data-tone={tone}
                />
              }
            />
          }
        >
          <GaugeIcon />
          {percent === null ? null : (
            <span
              aria-hidden
              className={cn(
                "absolute right-0 bottom-0 text-4xs leading-none font-semibold tabular-nums",
                BADGE_TONE[tone],
              )}
            >
              {percent}
            </span>
          )}
        </TooltipTrigger>
        <TooltipPopup side="bottom">
          {summary}
          {shortcut ? ` (${shortcut})` : ""}
        </TooltipPopup>
      </Tooltip>
      <PopoverPopup side="bottom" align="end" sideOffset={6} width="md" padding="compact">
        <UsageLimitsPanel
          accounts={accounts}
          now={now}
          timestampFormat={timestampFormat}
          onOpenUsagePage={onOpenUsagePage}
        />
      </PopoverPopup>
    </Popover>
  );
});

/**
 * Top-right account icons (abode F-044), just before the panel toggles:
 * Pull requests, Claude usage, Phone & Remote, Settings. Narrow headers fold
 * them into the ⋯ menu (see TopBarAccountMenuItems).
 */
export const TopBarAccountControls = memo(function TopBarAccountControls() {
  const pullRequestsSupported = usePullRequestsSupported();
  const nav = useAccountNavigation();
  return (
    <div
      className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]"
      data-top-bar-account-controls
    >
      {pullRequestsSupported ? (
        <ToolbarIconButton label="Pull requests" onClick={nav.openPullRequests}>
          <PullRequestGlyph.pullRequest />
        </ToolbarIconButton>
      ) : null}
      <UsageToolbarButton onOpenUsagePage={nav.openUsage} />
      <ToolbarIconButton label="Phone & Remote" onClick={nav.openConnections}>
        <SmartphoneIcon />
      </ToolbarIconButton>
      <ToolbarIconButton label="Settings" onClick={nav.openSettings}>
        <SettingsIcon />
      </ToolbarIconButton>
    </div>
  );
});

/** The phone-width copy of the account icons: entries in the header's ⋯ menu. */
export function TopBarAccountMenuItems() {
  const pullRequestsSupported = usePullRequestsSupported();
  const nav = useAccountNavigation();
  return (
    <>
      {pullRequestsSupported ? (
        <MenuItem onClick={nav.openPullRequests}>
          <PullRequestGlyph.pullRequest className="size-4" />
          <MenuItemLabel>Pull requests</MenuItemLabel>
        </MenuItem>
      ) : null}
      <MenuItem onClick={nav.openUsage}>
        <GaugeIcon className="size-4" />
        <MenuItemLabel>Usage</MenuItemLabel>
      </MenuItem>
      <MenuItem onClick={nav.openConnections}>
        <SmartphoneIcon className="size-4" />
        <MenuItemLabel>Phone & Remote</MenuItemLabel>
      </MenuItem>
      <MenuItem onClick={nav.openSettings}>
        <SettingsIcon className="size-4" />
        <MenuItemLabel>Settings</MenuItemLabel>
      </MenuItem>
    </>
  );
}

/**
 * The phone-width account entries for pages whose header has no ⋯ menu of its
 * own: one ⋯ button, hidden from md up where the icons show instead.
 */
export function TopBarAccountOverflowMenu() {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="icon-toolbar"
            variant="toolbar"
            aria-label="Account and navigation"
            className="md:hidden [-webkit-app-region:no-drag]"
          />
        }
      >
        <EllipsisIcon />
      </MenuTrigger>
      <MenuPopup aria-label="Account and navigation" align="end">
        <TopBarAccountMenuItems />
      </MenuPopup>
    </Menu>
  );
}
