import { useEffect, useState, useSyncExternalStore } from "react";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { SidebarInset, useSidebar } from "~/components/ui/sidebar";

import { useRemovedWorkspacesStore } from "../shell/workspaceRemovedStore";
import { useCanvasWorkspaces, type CanvasWorkspace } from "./useCanvasWorkspaces";
import { currentMilestoneName, planBlock } from "./planBlock";
import { usePlanFile } from "./usePlanFile";
import { workspaceInitials, type RailGroup } from "./railGroups";
import { OmniboxBar } from "./omnibox/OmniboxBar";
import { buildRouteContext, findSession } from "./omnibox/omniboxLogic";
import { routeMessage } from "./omnibox/routeMessage";
import { modeOf, useSessionModeStore } from "./sessionModeStore";
import { OverviewView } from "./OverviewView";
import { useLastSeenStore, useOverviewKeys } from "./overviewState";
import { WorkspaceView } from "./WorkspaceView";
import "./canvas.css";
import "./modes.css";
import "./phone.css";

const GROUP_LABEL: Record<RailGroup, string> = {
  need: "needs you",
  jam: "jam",
  move: "moving",
  quiet: "quiet",
};

const PHONE_QUERY = "(max-width: 640px)";
const subscribePhone = (notify: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

/** One phone list row (spec 6): initials, name, status word, current milestone. */
function PhoneRow(props: { readonly workspace: CanvasWorkspace; readonly onOpen: () => void }) {
  const { workspace, onOpen } = props;
  const root = workspace.newSessionTarget;
  const file = usePlanFile(root?.environmentId, root?.workspaceRoot, workspace.turnSignal);
  const milestone = file.pending ? undefined : currentMilestoneName(planBlock(file));
  return (
    <button type="button" data-cv-prow="" data-group={workspace.group} onClick={onOpen}>
      <span data-cv-ptile="">{workspaceInitials(workspace.name)}</span>
      <span data-cv-ptext="">
        <b>{workspace.name}</b>
        {milestone ? <span>{milestone}</span> : null}
      </span>
      {workspace.group === "need" ? <i data-cv-dot="" aria-hidden /> : null}
      <span data-cv-pstatus="">{GROUP_LABEL[workspace.group]}</span>
    </button>
  );
}

/** One Window (flag on): top bar, workspace rail, workspace view and omnibox. */
export function CanvasShell() {
  const { workspaces, hidden } = useCanvasWorkspaces();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = workspaces.find((workspace) => workspace.key === selectedKey) ?? workspaces[0];
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const [phoneView, setPhoneView] = useState<"list" | "workspace">("list");
  const { isMobile, setOpenMobile } = useSidebar();
  // Upstream's mobile sidebar sheet stays open after its logo link navigates here.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- closes an overlay owned by the sidebar
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  const [overview, setOverview] = useState(false);
  const closeOverview = () => {
    if (overview) useLastSeenStore.getState().markSeen();
    setOverview(false);
  };
  useOverviewKeys(overview, () => (overview ? closeOverview() : setOverview(true)), closeOverview);
  const [pinned, setPinned] = useState<string | undefined>(undefined);
  const modes = useSessionModeStore((state) => state.modes);
  // The session a message would reach with nothing typed: pinned, else routed (spec 5.5).
  const target = routeMessage(
    "",
    buildRouteContext({
      workspaces,
      view: overview ? "overview" : "workspace",
      selectedKey: selected?.key ?? "",
      pinned: pinned !== undefined && findSession(workspaces, pinned) ? pinned : undefined,
      modeOf: (key) => modeOf(modes, key),
    }),
  ).target;
  const targetMode =
    "all" in target || target.sessionId === null ? null : modeOf(modes, target.sessionId);

  return (
    <SidebarInset
      data-cv-root=""
      data-overview={overview ? "" : undefined}
      data-cv-phone={phone ? phoneView : undefined}
      className="h-dvh min-h-0 overflow-hidden overscroll-y-none"
    >
      <header data-cv-top="">
        <span data-cv-mark="" aria-hidden>
          ab
        </span>
        <div data-cv-title="">
          <b>One window</b>
          <span>
            {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
          </span>
        </div>
        <span data-cv-power="">
          <i aria-hidden />
          powered by T3 Code
        </span>
        <span data-cv-grow="" />
        <button
          type="button"
          data-cv-xbtn=""
          aria-label="Overview"
          aria-pressed={overview}
          onClick={() => (overview ? closeOverview() : setOverview(true))}
        >
          ⊞
        </button>
        <button type="button" data-cv-xbtn="" aria-label="Kit" aria-disabled="true" tabIndex={-1}>
          ⚙
        </button>
      </header>
      <div data-cv-body="">
        <nav data-cv-rail="" aria-label="Workspaces">
          {workspaces.map((workspace, index) => (
            <div key={workspace.key} data-cv-rail-item="">
              {index > 0 && workspaces[index - 1]?.group !== workspace.group ? (
                <hr data-cv-rsep="" />
              ) : null}
              <button
                type="button"
                data-cv-rl=""
                data-group={workspace.group}
                aria-current={workspace.key === selected?.key ? "true" : undefined}
                aria-label={`${workspace.name}, ${GROUP_LABEL[workspace.group]}`}
                onClick={() => setSelectedKey(workspace.key)}
              >
                <span>{workspaceInitials(workspace.name)}</span>
                {workspace.group === "need" ? <i data-cv-dot="" aria-hidden /> : null}
              </button>
            </div>
          ))}
          {hidden.length > 0 ? (
            <Menu>
              <MenuTrigger data-cv-hidden="" aria-label={`Hidden workspaces, ${hidden.length}`}>
                Hidden · {hidden.length}
              </MenuTrigger>
              <MenuPopup side="right" align="end">
                {hidden.map((workspace) => (
                  <MenuItem
                    key={workspace.key}
                    onClick={() =>
                      useRemovedWorkspacesStore.getState().setRemoved(workspace.key, false)
                    }
                  >
                    Restore {workspace.name}
                  </MenuItem>
                ))}
              </MenuPopup>
            </Menu>
          ) : null}
          <button
            type="button"
            data-cv-rl=""
            data-cv-add=""
            aria-label="New workspace"
            aria-disabled="true"
            tabIndex={-1}
          >
            +
          </button>
        </nav>
        {phone && phoneView === "list" ? (
          <nav data-cv-plist="" aria-label="Workspaces">
            {workspaces.map((workspace) => (
              <PhoneRow
                key={workspace.key}
                workspace={workspace}
                onOpen={() => {
                  setSelectedKey(workspace.key);
                  setPhoneView("workspace");
                }}
              />
            ))}
          </nav>
        ) : (
          <main data-cv-main="" data-mode={targetMode ?? undefined}>
            {selected ? (
              <WorkspaceView
                workspace={selected}
                onBack={phone ? () => setPhoneView("list") : undefined}
              />
            ) : (
              <h2>No workspace</h2>
            )}
          </main>
        )}
      </div>
      {overview ? (
        <OverviewView
          workspaces={workspaces}
          onSelect={(key) => {
            setSelectedKey(key);
            closeOverview();
          }}
        />
      ) : null}
      <div data-cv-dock="">
        <OmniboxBar
          workspaces={workspaces}
          selectedKey={selected?.key ?? ""}
          overview={overview}
          pinned={pinned}
          onPin={setPinned}
          targetMode={targetMode}
        />
      </div>
    </SidebarInset>
  );
}
