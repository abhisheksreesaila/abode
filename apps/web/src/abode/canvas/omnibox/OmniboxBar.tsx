import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "~/components/ui/menu";
import { toastManager } from "~/components/ui/toast";
import { openCommandPalette } from "~/commandPaletteBus";
import { buildThreadRouteParams } from "~/threadRoutes";

import { isLayerOpen } from "../overviewKeys";
import { isTyping } from "../overviewState";
import type { CanvasWorkspace } from "../useCanvasWorkspaces";
import { ChatDrawer } from "./ChatDrawer";
import {
  buildRouteContext,
  decideSend,
  findSession,
  omniboxKeyAction,
  type PreviewItem,
} from "./omniboxLogic";
import { ModeIcon } from "../ModeVisuals";
import { changeMode, MODES, type SessionMode } from "../sessionMode";
import { modeOf as storedModeOf, useSessionModeStore } from "../sessionModeStore";
import { routeMessage, targetLabel } from "./routeMessage";
import { useSessionSend } from "./useSessionSend";
import "./omnibox.css";

interface Preview {
  readonly text: string;
  readonly items: ReadonlyArray<PreviewItem>;
}

const toast = (type: "info" | "error", title: string, description?: string) =>
  toastManager.add({ type, title, ...(description ? { description } : {}) });

/** The omnibox: sends to the routed or pinned thread, opens the drawer, runs commands (A-046, A-047). */
export function OmniboxBar(props: {
  readonly workspaces: ReadonlyArray<CanvasWorkspace>;
  readonly selectedKey: string;
  readonly overview: boolean;
  /** The pinned session's key (lifted so the workspace card's edge follows the same target). */
  readonly pinned: string | undefined;
  readonly onPin: (sessionKey: string | undefined) => void;
  /** Mode of the session the next message would reach; null when it fans out or none exists. */
  readonly targetMode: SessionMode | null;
}) {
  const { workspaces, selectedKey, overview } = props;
  const modes = useSessionModeStore((state) => state.modes);
  const modeOf = (key: string) => storedModeOf(modes, key);
  const router = useRouter();
  const sendToSession = useSessionSend();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const { pinned, onPin: setPinned, targetMode } = props;
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const ctx = buildRouteContext({
    workspaces,
    view: overview ? "overview" : "workspace",
    selectedKey,
    pinned,
    modeOf,
  });
  const drawer = drawerKey ? findSession(workspaces, drawerKey) : null;
  const pinValid = pinned !== undefined && findSession(workspaces, pinned) !== null;

  // Capture phase, so Esc closes this layer before the overview's own Esc handler sees it.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- window key listener for "/" and Esc
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = omniboxKeyAction({
        key: event.key,
        mod: event.metaKey || event.ctrlKey || event.altKey,
        typing: isTyping(event.target),
        inOmnibox: event.target === inputRef.current,
        drawerOpen: drawerKey !== null,
        layerOpen: event.key === "Escape" && isLayerOpen(),
      });
      if (action === null) return;
      event.preventDefault();
      if (action === "focus") inputRef.current?.focus();
      else if (action === "close-drawer") setDrawerKey(null);
      else inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [drawerKey]);

  const sendTo = async (workspaceKey: string, sessionId: string | null, message: string) => {
    const hit = sessionId ? findSession(workspaces, sessionId) : null;
    if (!hit) {
      const name = workspaces.find((w) => w.key === workspaceKey)?.name ?? workspaceKey;
      toast(
        "info",
        `${name} has no session yet`,
        "Press + on its row to start one, then send again.",
      );
      return false;
    }
    const error = await sendToSession(hit.pill.environmentId, hit.pill.threadId, message);
    if (error !== null) toast("error", "Could not send", error);
    return error === null;
  };

  const runDecision = async () => {
    const decision = decideSend(text, ctx);
    if (decision.kind === "preview") {
      if (decision.items.length === 0) toast("info", "No workspace has a session to send to");
      else setPreview({ text: decision.text, items: decision.items });
      return;
    }
    if (decision.kind === "send") {
      if (await sendTo(decision.workspaceKey, decision.sessionId, decision.text)) {
        setText("");
        setDrawerKey(decision.sessionId);
      }
      return;
    }
    const { command } = decision;
    if (command.kind === "setMode") {
      const hit = findSession(workspaces, command.sessionId);
      if (hit) {
        const error = await changeMode({
          from: modeOf(command.sessionId),
          to: command.mode,
          store: (value) => useSessionModeStore.getState().setMode(command.sessionId, value),
          send: async (message) => {
            const failure = await sendToSession(hit.pill.environmentId, hit.pill.threadId, message);
            return failure === null ? null : new Error(failure);
          },
        });
        if (error !== null) {
          toast(
            "error",
            `Could not change ${hit.pill.title} to ${MODES[command.mode].label}`,
            error.message,
          );
        }
      }
    } else if (command.kind === "newWorkspace") {
      openCommandPalette({ open: "add-project" });
      toast(
        "info",
        `Create the folder for ${command.name}, then add it`,
        "Opened Add project; the canvas cannot create folders yet.",
      );
    } else if (command.kind === "briefMe") {
      const { target } = routeMessage("", ctx);
      if ("all" in target || target.sessionId === null) toast("info", "Nothing to brief on yet");
      else setDrawerKey(target.sessionId);
    } else {
      toast("info", "The tour comes later");
    }
    setText("");
  };

  const submit = () => {
    if (busy || text.trim() === "") return;
    setBusy(true);
    void runDecision().finally(() => setBusy(false));
  };

  const confirmPreview = () => {
    if (!preview || busy) return;
    const { items, text: message } = preview;
    setBusy(true);
    void Promise.all(items.map((item) => sendTo(item.workspaceKey, item.sessionId, message)))
      .then((results) => {
        const failed = results.filter((ok) => !ok).length;
        if (failed === 0) setText("");
        setPreview(null);
      })
      .finally(() => setBusy(false));
  };

  const openFull = () => {
    if (!drawer) return;
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(
        scopeThreadRef(drawer.pill.environmentId, drawer.pill.threadId),
      ),
    });
  };

  const chipWorkspaces = overview ? workspaces : workspaces.filter((w) => w.key === selectedKey);
  return (
    <div data-cvo-wrap="">
      {drawer ? (
        <ChatDrawer
          workspaceName={drawer.workspace.name}
          cwd={drawer.workspace.newSessionTarget?.workspaceRoot}
          pill={drawer.pill}
          mode={modeOf(drawer.pill.key)}
          pinned={pinned === drawer.pill.key}
          onTogglePin={() => setPinned(pinned === drawer.pill.key ? undefined : drawer.pill.key)}
          onOpenFull={openFull}
          onClose={() => setDrawerKey(null)}
        />
      ) : null}
      {preview ? (
        <section data-cvo-preview="" aria-label="Send to all workspaces">
          <b>This will go to {preview.items.length} workspaces</b>
          <ul>
            {preview.items.map((item) => (
              <li key={item.sessionId}>
                <span>{item.workspaceName}</span>
                <em>{item.sessionTitle}</em>
              </li>
            ))}
          </ul>
          <div data-cvo-actions="">
            <button type="button" data-cvo-btn="" onClick={() => setPreview(null)}>
              Cancel
            </button>
            <button type="button" data-cvo-btn="primary" disabled={busy} onClick={confirmPreview}>
              Send
            </button>
          </div>
        </section>
      ) : null}
      <div data-cv-bar="">
        {targetMode ? (
          <span data-cv-mtag="" data-mode={targetMode}>
            <ModeIcon mode={targetMode} />
            {MODES[targetMode].label}
          </span>
        ) : null}
        <input
          ref={inputRef}
          data-cv-in=""
          placeholder="Tell any session…"
          aria-label="Omnibox"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Menu>
          <MenuTrigger data-cvo-chip="" aria-label="Send target">
            → {targetLabel(ctx)}
          </MenuTrigger>
          <MenuPopup side="top" align="end">
            <MenuItem disabled={!pinValid} onClick={() => setPinned(undefined)}>
              Unpin (auto-route)
            </MenuItem>
            <MenuSeparator />
            {chipWorkspaces.map((workspace) => (
              <MenuGroup key={workspace.key}>
                <MenuGroupLabel>{workspace.name}</MenuGroupLabel>
                {workspace.sessions.pills.map((pill) => (
                  <MenuItem key={pill.key} onClick={() => setPinned(pill.key)}>
                    {pill.title}
                  </MenuItem>
                ))}
              </MenuGroup>
            ))}
          </MenuPopup>
        </Menu>
        <button
          type="button"
          data-cvo-send=""
          aria-label="Send"
          disabled={busy || text.trim() === ""}
          onClick={submit}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
