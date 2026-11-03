import { useState } from "react";

import { SidebarInset } from "~/components/ui/sidebar";

import { useCanvasWorkspaces } from "./useCanvasWorkspaces";
import { workspaceInitials, type RailGroup } from "./railGroups";
import "./canvas.css";

const GROUP_LABEL: Record<RailGroup, string> = {
  need: "needs you",
  jam: "jam",
  move: "moving",
  quiet: "quiet",
};

/** One Window (flag on): top bar, workspace rail, workspace view and omnibox. */
export function CanvasShell() {
  const workspaces = useCanvasWorkspaces();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = workspaces.find((workspace) => workspace.key === selectedKey) ?? workspaces[0];

  return (
    <SidebarInset data-cv-root="" className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
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
        <button type="button" data-cv-xbtn="" aria-label="Overview">
          ⊞
        </button>
        <button type="button" data-cv-xbtn="" aria-label="Kit">
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
          <button type="button" data-cv-rl="" data-cv-add="" aria-label="New workspace">
            +
          </button>
        </nav>
        <main data-cv-main="">
          <h2>{selected?.name ?? "No workspace"}</h2>
        </main>
      </div>
      <div data-cv-dock="">
        <div data-cv-bar="">
          <input data-cv-in="" placeholder="Tell any session…" aria-label="Omnibox" readOnly />
        </div>
      </div>
    </SidebarInset>
  );
}
