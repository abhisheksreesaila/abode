import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { buildThreadRouteParams } from "~/threadRoutes";

import { useRemovedWorkspacesStore } from "../shell/workspaceRemovedStore";
import type { SessionPill } from "./sessionPills";
import type { CanvasWorkspace } from "./useCanvasWorkspaces";

/** Autopilot for every session until the mode picker lands (A-045): a paper plane. */
function ModeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden data-cv-mode="">
      <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" />
    </svg>
  );
}

function Pill(props: { readonly pill: SessionPill; readonly onOpen: () => void }) {
  const { pill, onOpen } = props;
  return (
    <button type="button" data-cv-sc="" onClick={onOpen}>
      <span data-cv-mbtn="">
        <ModeIcon />
      </span>
      <b>{pill.title}</b>
      <span data-cv-mt="" aria-hidden>
        {pill.dots.map((provider, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- dots have no identity beyond position
          <span key={index} data-cv-mt-part="">
            {index === 1 ? <em>→</em> : null}
            <i data-provider={provider} />
          </span>
        ))}
      </span>
      {pill.status !== null ? <span data-cv-sw="">{pill.status}</span> : null}
    </button>
  );
}

/** The selected workspace: its name and menu, then one pill per live session, "N done" and "+". */
export function WorkspaceView(props: { readonly workspace: CanvasWorkspace }) {
  const { workspace } = props;
  const router = useRouter();
  const handleNewThread = useNewThreadHandler();
  const [showDone, setShowDone] = useState(false);
  const [fresh, setFresh] = useState(false);
  const { pills, done, doneCount } = workspace.sessions;

  const open = (pill: SessionPill) => {
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(pill.environmentId, pill.threadId)),
    });
  };

  const addSession = async () => {
    const target = workspace.newSessionTarget;
    if (target === undefined) return;
    setFresh(true);
    // No options: branch, worktree and env mode come from the user's defaults, like the sidebar's "+".
    const result = await settlePromise(() =>
      handleNewThread(scopeProjectRef(target.environmentId, target.id)),
    );
    setFresh(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not create session",
          description: error instanceof Error ? error.message : "An error occurred.",
        }),
      );
    }
  };

  return (
    <div data-cv-ws="" data-fresh={fresh ? "" : undefined}>
      <div data-cv-head="">
        <h2>{workspace.name}</h2>
        <Menu>
          <MenuTrigger data-cv-xbtn="" aria-label="Workspace menu">
            …
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem
              onClick={() => useRemovedWorkspacesStore.getState().setRemoved(workspace.key, true)}
            >
              Hide workspace
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      <div data-cv-sess="" aria-label="Sessions" role="group">
        {pills.map((pill) => (
          <Pill key={pill.key} pill={pill} onOpen={() => open(pill)} />
        ))}
        {showDone
          ? done.map((pill) => <Pill key={pill.key} pill={pill} onOpen={() => open(pill)} />)
          : null}
        {doneCount > 0 ? (
          <button
            type="button"
            data-cv-sc=""
            data-cv-more=""
            aria-expanded={showDone}
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? "hide" : doneCount} done
          </button>
        ) : null}
        <button
          type="button"
          data-cv-sc=""
          data-cv-add-session=""
          aria-label="New session"
          onClick={() => void addSession()}
        >
          +
        </button>
      </div>
    </div>
  );
}
