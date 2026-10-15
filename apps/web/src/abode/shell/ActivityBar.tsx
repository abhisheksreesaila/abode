import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { MessagesSquareIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { useCallback, type ReactNode } from "react";

import { useNavigateToMainApp } from "~/components/sidebar/mainAppLocation";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useSidebar } from "~/components/ui/sidebar";
import { openCommandPalette } from "~/commandPaletteBus";
import { useAtomValue } from "@effect/atom-react";
import { shortcutLabelForCommand } from "~/keybindings";
import { primaryServerKeybindingsAtom } from "~/state/server";
import {
  activeActivityItem,
  agentsClickAction,
  visibleActivityItems,
  type ActivityItemId,
} from "./activityBar";

const ICONS: Record<ActivityItemId, ReactNode> = {
  agents: <MessagesSquareIcon />,
  search: <SearchIcon />,
  settings: <SettingsIcon />,
};

/**
 * The 48px rail on the far left. Upstream's floating sidebar toggle sits just
 * right of it (see `abodeShellProviderStyle`), so the rail never covers it.
 */
export function ActivityBar() {
  const navigate = useNavigate();
  const navigateToMainApp = useNavigateToMainApp();
  const { open, setOpen } = useSidebar();
  const pathname = useLocation({ select: (location) => location.pathname });
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const active = activeActivityItem(pathname);
  const items = visibleActivityItems();

  const handleClick = useCallback(
    (id: ActivityItemId) => {
      switch (id) {
        case "agents":
          if (agentsClickAction({ active }) === "toggle-sidebar") {
            void setOpen(!open);
          } else {
            void setOpen(true);
            void navigateToMainApp();
          }
          return;
        case "search":
          openCommandPalette();
          return;
        case "settings":
          void navigate({ to: "/settings" });
          return;
      }
    },
    [active, navigate, navigateToMainApp, open, setOpen],
  );

  const renderItem = (id: ActivityItemId, label: string) => {
    // Like a VS Code view icon, Agents is only lit while its sidebar is showing.
    const lit = id === active && (id !== "agents" || open);
    const shortcut =
      id === "search" ? shortcutLabelForCommand(keybindings, "commandPalette.toggle") : null;
    return (
      <Tooltip key={id}>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              aria-current={id === active ? "page" : undefined}
              data-testid={`activity-bar-${id}`}
              data-active={lit}
              onClick={() => handleClick(id)}
              data-abode="activity-item"
            />
          }
        >
          {ICONS[id]}
        </TooltipTrigger>
        <TooltipPopup side="right">
          {label}
          {shortcut ? ` (${shortcut})` : ""}
        </TooltipPopup>
      </Tooltip>
    );
  };

  return (
    <nav
      aria-label="Activity bar"
      data-abode-activity-bar=""
      className="hidden h-dvh w-(--abode-activity-bar-width) shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      <Link
        to="/"
        aria-label="abode home"
        className="flex h-[var(--workspace-topbar-height)] shrink-0 items-center justify-center text-base font-bold tracking-tight outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ color: "var(--primary)" }}
      >
        ab
      </Link>
      {items
        .filter((item) => item.placement === "top")
        .map((item) => renderItem(item.id, item.label))}
      <div className="flex-1" />
      {items
        .filter((item) => item.placement === "bottom")
        .map((item) => renderItem(item.id, item.label))}
    </nav>
  );
}
