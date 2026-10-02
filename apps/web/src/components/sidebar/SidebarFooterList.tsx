import { useAtomValue } from "@effect/atom-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, SettingsIcon, SmartphoneIcon, SparklesIcon } from "lucide-react";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import { memo, useCallback } from "react";

import { useEnvironments } from "../../state/environments";
import { customizationsEnvironment } from "../../state/customizations";
import { PullRequestGlyph } from "../pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import {
  useActiveCustomizationsScope,
  useCustomizationsExpanded,
  type CustomizationsScope,
} from "../customizations/CustomizationsSection";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../ui/sidebar";
import { SidebarUpdatePill } from "./SidebarUpdatePill";
import { SidebarFooterRow } from "./SidebarFooterRow";
import { SidebarSectionHeader } from "./FluentSidebarParts";
import { SidebarUsageStatus } from "./SidebarUsageStatus";
import { isSidebarUtilityPage, useNavigateToMainApp } from "./mainAppLocation";

/** The workspace's customization count, read from the list the section already caches. */
function CustomizationsCount({ scope }: { readonly scope: CustomizationsScope }) {
  const result = useAtomValue(
    customizationsEnvironment.list({
      environmentId: scope.environmentId,
      input: { cwd: scope.cwd },
    }),
  );
  const items = Option.getOrNull(AsyncResult.value(result))?.items;
  return items ? <>{items.length}</> : null;
}

/**
 * The sidebar footer's "Account" list (abode F-025, Fluent in F-028). Everything the old icon
 * strip reached stays reachable: Settings (now in the activity bar), Pull requests, Usage (the usage row's
 * popover links to the page), Back on utility pages, and the update pill.
 */
export const SidebarFooterList = memo(function SidebarFooterList() {
  const navigate = useNavigate();
  const navigateToMainApp = useNavigateToMainApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const isOnUtilityPage = useLocation({
    select: (location) => isSidebarUtilityPage(location.pathname),
  });
  const { environments } = useEnvironments();
  // The page reads every connected server, so one of them offering pull requests is enough for
  // the row to lead somewhere.
  const pullRequestsSupported = environments.some(
    (environment) => environment.serverConfig?.environment.capabilities.pullRequests === true,
  );
  const customizationsScope = useActiveCustomizationsScope();
  const [customizationsExpanded, setCustomizationsExpanded] = useCustomizationsExpanded();

  const go = useCallback(
    (open: () => void) => () => {
      if (isMobile) setOpenMobile(false);
      open();
    },
    [isMobile, setOpenMobile],
  );
  const openPullRequests = go(
    () => void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() }),
  );
  const openUsage = go(() => void navigate({ to: "/usage" }));
  const openConnections = go(() => void navigate({ to: "/settings/connections" }));
  const openSettings = go(() => void navigate({ to: "/settings" }));
  const goBack = go(() => void navigateToMainApp());

  return (
    <div className="flex flex-col">
      <SidebarSectionHeader label="Account" />
      {isOnUtilityPage ? (
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={goBack}>
              <ArrowLeftIcon />
              <span>Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      ) : null}
      {pullRequestsSupported ? (
        <SidebarFooterRow
          color="pr"
          icon={<PullRequestGlyph.pullRequest />}
          title="Pull Requests"
          onClick={openPullRequests}
        />
      ) : null}
      <SidebarUsageStatus onOpenUsagePage={openUsage} />
      <SidebarFooterRow
        color="customizations"
        icon={<SparklesIcon />}
        title="Customizations"
        aria-expanded={customizationsExpanded}
        disabled={!customizationsScope}
        subtitle={customizationsScope ? undefined : "Open a thread"}
        end={customizationsScope ? <CustomizationsCount scope={customizationsScope} /> : null}
        onClick={() => setCustomizationsExpanded((current) => !current)}
      />
      <SidebarFooterRow
        color="phone"
        icon={<SmartphoneIcon />}
        title="Phone & Remote"
        onClick={openConnections}
      />
      {/* Desktop widths reach Settings from the activity bar; phones have no rail. */}
      <SidebarFooterRow
        className="md:hidden"
        color="settings"
        icon={<SettingsIcon />}
        title="Settings"
        onClick={openSettings}
      />
      <SidebarMenu>
        <SidebarUpdatePill />
      </SidebarMenu>
    </div>
  );
});
