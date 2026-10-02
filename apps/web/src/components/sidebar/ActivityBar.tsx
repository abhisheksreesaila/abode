import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  MessagesSquareIcon,
  RadioTowerIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import { memo, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import {
  useActiveCustomizationsScope,
  useCustomizationsExpanded,
} from "../customizations/CustomizationsSection";
import { CommandDialogTrigger } from "../ui/command";
import { useSidebar, useSidebarVisibility } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ACTIVITY_BAR_WIDTH_PX, resolveActiveActivityItem } from "./activityBar";

const CELL_CLASS =
  "relative flex size-12 shrink-0 cursor-pointer items-center justify-center text-sidebar-muted-foreground outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default disabled:opacity-40 disabled:hover:text-sidebar-muted-foreground data-[active=true]:text-white data-[active=true]:before:absolute data-[active=true]:before:inset-y-0 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:bg-primary [&>svg]:size-[22px]";

/** One 48x48 cell with a tooltip. `render` swaps the button, e.g. for the palette trigger. */
function ActivityBarButton({
  label,
  active,
  icon,
  render,
  ...props
}: Omit<ComponentProps<"button">, "children" | "render"> & {
  readonly label: string;
  readonly active?: boolean;
  readonly icon: ReactNode;
  readonly render?: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          render ?? (
            <button
              type="button"
              aria-label={label}
              data-active={active === true}
              className={CELL_CLASS}
              {...props}
            />
          )
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipPopup side="right">{label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * The 48px rail left of the sidebar (abode F-028). Every button leads somewhere
 * the footer or sidebar already did. Phone widths keep the sheet sidebar and
 * hide the rail.
 */
export const ActivityBar = memo(function ActivityBar() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { toggleSidebar, setOpen } = useSidebar();
  const sidebarOpen = useSidebarVisibility();
  const active = resolveActiveActivityItem({ pathname, sidebarOpen });
  const customizationsScope = useActiveCustomizationsScope();
  const [customizationsExpanded, setCustomizationsExpanded] = useCustomizationsExpanded();

  return (
    <nav
      aria-label="Activity bar"
      data-slot="activity-bar"
      style={{ width: ACTIVITY_BAR_WIDTH_PX }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar md:flex"
    >
      <div className="flex flex-col">
        <Link
          to="/"
          aria-label="Go to threads"
          className="flex h-12 w-12 items-center justify-center text-base font-bold tracking-tight text-(--icon-customizations) outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          ab
        </Link>
        <ActivityBarButton
          label="Agents"
          active={active === "agents"}
          icon={<MessagesSquareIcon />}
          aria-expanded={sidebarOpen}
          onClick={toggleSidebar}
        />
        <ActivityBarButton
          label="Search"
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
        <ActivityBarButton
          label="Pull requests"
          active={active === "pull-requests"}
          icon={<PullRequestGlyph.pullRequest />}
          onClick={() =>
            void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() })
          }
        />
        <ActivityBarButton
          label={customizationsScope ? "Customizations" : "Customizations (open a thread)"}
          icon={<SparklesIcon />}
          disabled={!customizationsScope}
          aria-expanded={customizationsExpanded && sidebarOpen}
          onClick={() => {
            // The list lives in the sidebar, so a closed sidebar opens it rather than toggling.
            if (!sidebarOpen) {
              setOpen(true);
              setCustomizationsExpanded(true);
            } else {
              setCustomizationsExpanded((current) => !current);
            }
          }}
        />
      </div>
      <div className="flex flex-col">
        <ActivityBarButton
          label="Connections"
          active={active === "connections"}
          icon={<RadioTowerIcon />}
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
