import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { observeResize } from "~/lib/observeResize";
import { useProject, useThreadShell } from "~/state/entities";
import { resolveActiveThreadRouteRef, resolveThreadRouteTarget } from "~/threadRoutes";

import { KitMeter, KitPane, KitStrip, KitTabs, type KitTab } from "./KitFrame";
import { useHostHomePath } from "./kitData";
import { isKitProject } from "./kitMode";
import "./frame.css";

const TICK_MS = 30_000;

/**
 * The Kit above the chat on Kit threads (a project rooted at the host's home folder): the
 * Skills · MCP · Plugins · Hooks · Updates tabs, the daily check and the panes. Renders nothing
 * on any other thread, so the rest of the chat is T3's own.
 */
export function KitView() {
  const target = useParams({ strict: false, select: (params) => resolveThreadRouteTarget(params) });
  const draft = useComposerDraftStore((store) =>
    target?.kind === "draft" ? store.getDraftSession(target.draftId) : null,
  );
  const threadRef = resolveActiveThreadRouteRef(target, draft);
  const shell = useThreadShell(threadRef);
  const owner = shell ?? draft;
  const project = useProject(
    owner === null ? null : scopeProjectRef(owner.environmentId, owner.projectId),
  );
  const hostHome = useHostHomePath(project?.environmentId);
  if (project === null || !isKitProject(project.workspaceRoot, hostHome)) return null;
  return (
    <LoadedKit
      scope={{
        environmentId: project.environmentId,
        cwd: project.workspaceRoot,
        projectName: project.title,
        // The composer to fill: the thread, or an unsent draft's own ref (drafts have no thread yet).
        threadRef:
          threadRef ??
          (draft === null ? null : scopeThreadRef(draft.environmentId, draft.threadId)),
        borrowed: false,
      }}
      running={shell?.latestRun?.status === "running"}
    />
  );
}

function LoadedKit(props: {
  readonly scope: Parameters<typeof KitTabs>[0]["scope"];
  readonly running: boolean;
}) {
  const { scope, running } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<KitTab>("skills");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // "checked 2h ago" stays current; nothing animates.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a timer that refreshes elapsed-time labels
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // The pane starts below the Kit rows, which are as tall as their content.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- publishes the rows' height as a CSS variable on the chat canvas
  useEffect(() => {
    const root = rootRef.current;
    const area = root?.closest<HTMLElement>("[data-chat-canvas]") ?? root?.parentElement;
    if (!root || !area) return;
    const apply = () => area.style.setProperty("--abode-frame-h", `${root.offsetHeight}px`);
    apply();
    const stop = observeResize(root, apply);
    return () => {
      stop();
      area.style.removeProperty("--abode-frame-h");
    };
  }, []);

  // Marks the conversation area while a pane covers it, so frame.css can dock a draft's hero composer.
  const paneOpen = tab !== "jam";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- sets a data attribute on the conversation area, which upstream renders
  useEffect(() => {
    const area = rootRef.current?.parentElement;
    if (!area || !paneOpen) return;
    area.setAttribute("data-abode-pane-open", "");
    return () => area.removeAttribute("data-abode-pane-open");
  }, [paneOpen]);

  const agent = running
    ? {
        status: "in-progress" as const,
        statusLabel: "working",
        meta: "~",
        doing: "Working on your kit",
      }
    : null;

  return (
    <>
      <div ref={rootRef} data-abode-frame="" data-testid="kit-view">
        <div data-abode-frame-head="">
          <KitTabs scope={scope} tab={tab} onTab={setTab} />
          <KitMeter scope={scope} where="head" />
        </div>
        <KitStrip scope={scope} agent={agent} nowMs={nowMs} onTab={setTab} />
      </div>
      {tab === "jam" ? null : <KitPane scope={scope} tab={tab} nowMs={nowMs} onTab={setTab} />}
    </>
  );
}
