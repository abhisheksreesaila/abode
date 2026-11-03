import { useState } from "react";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { SidebarInset } from "~/components/ui/sidebar";

import { useRemovedWorkspacesStore } from "../shell/workspaceRemovedStore";
import { composeSessions, routedSession } from "./composeBlocks";
import { ModeIcon } from "./ModeVisuals";
import { MODES } from "./sessionMode";
import { useSessionModeStore } from "./sessionModeStore";
import { useCanvasWorkspaces } from "./useCanvasWorkspaces";
import { workspaceInitials, type RailGroup } from "./railGroups";
import { OverviewView } from "./OverviewView";
import { useLastSeenStore, useOverviewKeys } from "./overviewState";
import { WorkspaceView } from "./WorkspaceView";
import "./canvas.css";
import "./modes.css";

const GROUP_LABEL: Record<RailGroup, string> = {
  need: "needs you",
  jam: "jam",
  move: "moving",
  quiet: "quiet",
};

/** One Window (flag on): top bar, workspace rail, workspace view and omnibox. */
export function CanvasShell() {
  const { workspaces, hidden } = useCanvasWorkspaces();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = workspaces.find((workspace) => workspace.key === selectedKey) ?? workspaces[0];
  const [overview, setOverview] = useState(false);
  const closeOverview = () => {
    if (overview) useLastSeenStore.getState().markSeen();
    setOverview(false);
  };
  useOverviewKeys(overview, () => (overview ? closeOverview() : setOverview(true)), closeOverview);
  const modes = useSessionModeStore((state) => state.modes);
  // The mode of the session a message would reach (spec 5.5 routing); A-046 binds the real target.
  const routed = selected
    ? routedSession(composeSessions(selected.sessions.pills, modes))
    : undefined;

  return (
    <SidebarInset
      data-cv-root=""
      data-overview={overview ? "" : undefined}
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
        <main data-cv-main="" data-mode={routed?.mode}>
          {selected ? <WorkspaceView workspace={selected} /> : <h2>No workspace</h2>}
        </main>
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
        <div data-cv-bar="">
          {routed ? (
            <span data-cv-mtag="" data-mode={routed.mode}>
              <ModeIcon mode={routed.mode} />
              {MODES[routed.mode].label}
            </span>
          ) : null}
          <input
            data-cv-in=""
            placeholder="Tell any session…"
            aria-label="Omnibox"
            aria-disabled="true"
            tabIndex={-1}
            readOnly
          />
        </div>
      </div>
    </SidebarInset>
  );
}
