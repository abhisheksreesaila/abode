import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/patrick-hand/400.css";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import { openCommandPalette } from "~/commandPaletteBus";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { SidebarInset, useSidebar } from "~/components/ui/sidebar";

import { useRemovedWorkspacesStore } from "../shell/workspaceRemovedStore";
import { useCanvasWorkspaces, type CanvasWorkspace } from "./useCanvasWorkspaces";
import { currentMilestoneName, planBlock } from "./planBlock";
import { usePlanFile } from "./usePlanFile";
import { workspaceInitials, type RailGroup } from "./railGroups";
import { AddMachineGuide } from "./AddMachineGuide";
import { useAddMachineStore } from "./addMachineStore";
import { useFreshMoment } from "./useFreshMoment";
import { useOpenSession } from "./useOpenSession";
import { useOpenKit } from "../frame/useOpenKit";
import { OverviewView } from "./OverviewView";
import { useLastSeenStore, useOverviewKeys } from "./overviewState";
import { WorkspaceView } from "./WorkspaceView";
import "./canvas.css";
import "./phone.css";

const GROUP_LABEL: Record<RailGroup, string> = {
  need: "needs you",
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

function sessionCount(workspace: CanvasWorkspace): string {
  const live = workspace.sessions.pills.length;
  return live === 0 ? "No live sessions" : `${live} live ${live === 1 ? "session" : "sessions"}`;
}

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

/** One Window (flag on): top bar, workspace rail and workspace view. */
export function CanvasShell() {
  const router = useRouter();
  const { workspaces, hidden } = useCanvasWorkspaces();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = workspaces.find((workspace) => workspace.key === selectedKey) ?? workspaces[0];
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const [phoneView, setPhoneView] = useState<"list" | "workspace">("list");
  // Phone shows the workspace only while the chosen one still exists; otherwise the list.
  const showWorkspace = phoneView === "workspace" && workspaces.some((w) => w.key === selectedKey);
  const { isMobile, setOpenMobile } = useSidebar();
  // Upstream's mobile sidebar sheet stays open after its logo link navigates here.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- closes an overlay owned by the sidebar
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  const [overview, setOverview] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  // A workspace added from the palette gets the focus moment and is selected (spec 5.11).
  const freshWorkspace = useFreshMoment(
    "workspaces",
    workspaces.map((workspace) => workspace.key),
    setSelectedKey,
  );
  const openKit = useOpenKit();
  const closeOverview = () => {
    if (overview) useLastSeenStore.getState().markSeen();
    setOverview(false);
  };
  const toggleOverview = () => {
    if (overview) return closeOverview();
    setOverview(true);
  };
  // The Kit is a thread in the home-folder project, so it leaves the control room.
  const toggleKit = () => {
    closeOverview();
    void openKit();
  };
  useOverviewKeys(overview, toggleOverview, closeOverview);
  const openSession = useOpenSession();

  return (
    <SidebarInset
      data-cv-root=""
      data-overview={overview ? "" : undefined}
      data-rail={railOpen && !phone ? "open" : undefined}
      data-focus={freshWorkspace === null ? undefined : ""}
      className="h-dvh min-h-0 overflow-hidden overscroll-y-none"
    >
      <header data-cv-top="">
        {phone ? null : (
          <button
            type="button"
            data-cv-xbtn=""
            aria-label="Workspaces"
            aria-pressed={railOpen}
            onClick={() => setRailOpen(!railOpen)}
          >
            <svg viewBox="0 0 24 24" aria-hidden width="18" height="18" data-cv-sideicon="">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M9 4v16" />
            </svg>
          </button>
        )}
        <Menu>
          <MenuTrigger data-cv-mark="" aria-label="T3 Code settings menu">
            ab
          </MenuTrigger>
          <MenuPopup align="start">
            <MenuItem onClick={() => void router.navigate({ to: "/settings" })}>
              T3 Code settings
            </MenuItem>
          </MenuPopup>
        </Menu>
        <div data-cv-title="">
          <b>One window</b>
          <span>
            {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
          </span>
        </div>
        <span data-cv-power="">
          <b aria-hidden>T3</b>
          powered by T3 Code
        </span>
        <span data-cv-grow="" />
        <button
          type="button"
          data-cv-xbtn=""
          aria-label="Overview"
          aria-pressed={overview}
          onClick={toggleOverview}
        >
          ⊞
        </button>
        <button type="button" data-cv-xbtn="" aria-label="Kit" onClick={toggleKit}>
          ⚙
        </button>
      </header>
      <div data-cv-body="">
        <nav data-cv-rail="" aria-label="Workspaces">
          {workspaces.map((workspace, index) => {
            const newGroup = index === 0 || workspaces[index - 1]?.group !== workspace.group;
            return (
              <div key={workspace.key} data-cv-rail-item="">
                {newGroup ? (
                  <>
                    {index > 0 ? <hr data-cv-rsep="" /> : null}
                    <span data-cv-rgrp="">{GROUP_LABEL[workspace.group]}</span>
                  </>
                ) : null}
                <button
                  type="button"
                  data-cv-rl=""
                  data-group={workspace.group}
                  data-fresh={workspace.key === freshWorkspace ? "" : undefined}
                  aria-current={workspace.key === selected?.key ? "true" : undefined}
                  aria-label={`${workspace.name}, ${GROUP_LABEL[workspace.group]}`}
                  onClick={() => setSelectedKey(workspace.key)}
                >
                  <span data-cv-tile="">
                    <span data-cv-ini="">{workspaceInitials(workspace.name)}</span>
                    {workspace.group === "need" ? <i data-cv-dot="" aria-hidden /> : null}
                  </span>
                  <span data-cv-rtext="">
                    <b>{workspace.name}</b>
                    <small>{sessionCount(workspace)}</small>
                  </span>
                </button>
              </div>
            );
          })}
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
            onClick={() => openCommandPalette({ open: "add-project" })}
          >
            +
          </button>
          <button
            type="button"
            data-cv-rl=""
            data-cv-add=""
            aria-label="Add a machine"
            onClick={() => useAddMachineStore.getState().setOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden width="18" height="18" data-cv-addm-icon="">
              <rect x="3" y="4" width="14" height="10" rx="2" />
              <path d="M7 18h6M20 15v6M17 18h6" />
            </svg>
          </button>
        </nav>
        {phone && !showWorkspace ? (
          <nav data-cv-plist="" aria-label="Workspaces">
            {workspaces.length === 0 ? <p data-cv-pempty="">No workspaces yet</p> : null}
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
          <main data-cv-main="">
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
          onSelect={(key, sessionKey) => {
            setSelectedKey(key);
            closeOverview();
            const pill = workspaces
              .flatMap((w) => [...w.sessions.pills, ...w.sessions.done])
              .find((p) => p.key === sessionKey);
            if (pill) openSession(pill);
          }}
        />
      ) : null}
      <AddMachineGuide />
    </SidebarInset>
  );
}
