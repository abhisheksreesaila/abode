import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { MessagesSquareIcon, SearchIcon, SettingsIcon, SmartphoneIcon } from "lucide-react";
import { memo } from "react";

import { useAtomValue } from "@effect/atom-react";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { useEnvironments } from "../../state/environments";
import { cn } from "../../lib/utils";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import { CommandDialogTrigger } from "../ui/command";
import { useSidebar, useSidebarVisibility } from "../ui/sidebar";
import { ACTIVITY_BAR_WIDTH_PX, resolveActiveActivityItem } from "./activityBar";
import { ActivityBarButton, CELL_CLASS } from "./ActivityBarButton";
import { ActivityBarUsage } from "./ActivityBarUsage";
import { isSidebarUtilityPage, useNavigateToMainApp } from "./mainAppLocation";

/**
 * The 48px rail left of the sidebar (abode F-028, F-036). Top: logo, Sessions, Search.
 * Bottom: Pull requests, Claude usage, Phone & Remote, Settings. Phone widths hide the
 * rail and reach the same items from the sheet's account rows.
 */
export const ActivityBar = memo(function ActivityBar({
  reserveTitlebar = false,
}: {
  /** macOS window controls overlay the strip above the rail; the first cell starts below it. */
  readonly reserveTitlebar?: boolean;
}) {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { toggleSidebar, setOpen } = useSidebar();
  const navigateToMainApp = useNavigateToMainApp();
  const sidebarOpen = useSidebarVisibility();
  const active = resolveActiveActivityItem({ pathname, sidebarOpen });
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const searchShortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const { environments } = useEnvironments();
  // Same check as the sidebar footer: one connected server offering pull requests is enough.
  const pullRequestsSupported = environments.some(
    (environment) => environment.serverConfig?.environment.capabilities.pullRequests === true,
  );

  return (
    <nav
      aria-label="Activity bar"
      data-slot="activity-bar"
      style={{
        width: ACTIVITY_BAR_WIDTH_PX,
        ...(reserveTitlebar ? { paddingTop: "var(--workspace-topbar-height)" } : {}),
      }}
      className={cn(
        "sticky top-0 hidden h-full shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar md:flex",
      )}
    >
      {reserveTitlebar ? (
        <div
          aria-hidden
          className="drag-region absolute inset-x-0 top-0"
          style={{ height: "var(--workspace-topbar-height)" }}
        />
      ) : null}
      <div className="flex flex-col">
        <Link
          to="/"
          aria-label="Go to threads"
          className="flex h-12 w-12 items-center justify-center text-base font-bold tracking-tight text-(--icon-customizations) outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          ab
        </Link>
        <ActivityBarButton
          label="Sessions"
          active={active === "sessions"}
          icon={<MessagesSquareIcon />}
          aria-expanded={sidebarOpen}
          onClick={() => {
            // On Settings, Usage or Pull requests the sidebar is not the session list: go back to it.
            if (isSidebarUtilityPage(pathname)) {
              setOpen(true);
              void navigateToMainApp();
              return;
            }
            toggleSidebar();
          }}
        />
        <ActivityBarButton
          label={searchShortcut ? `Search (${searchShortcut})` : "Search"}
          icon={<SearchIcon />}
          render={
            <CommandDialogTrigger
              render={
                <button
                  type="button"
                  aria-label="Search"
                  data-testid="activity-bar-search"
                  className={CELL_CLASS}
                />
              }
            />
          }
        />
      </div>
      <div className="flex flex-col">
        {pullRequestsSupported ? (
          <ActivityBarButton
            label="Pull requests"
            active={active === "pull-requests"}
            icon={<PullRequestGlyph.pullRequest />}
            onClick={() =>
              void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() })
            }
          />
        ) : null}
        <ActivityBarUsage
          active={active === "usage"}
          onOpenUsagePage={() => void navigate({ to: "/usage" })}
        />
        <ActivityBarButton
          label="Phone & Remote"
          active={active === "connections"}
          icon={<SmartphoneIcon />}
          onClick={() => void navigate({ to: "/settings/connections" })}
        />
        <ActivityBarButton
          label="Settings"
          active={active === "settings"}
          icon={<SettingsIcon />}
          onClick={() => void navigate({ to: "/settings" })}
        />
      </div>
    </nav>
  );
});
