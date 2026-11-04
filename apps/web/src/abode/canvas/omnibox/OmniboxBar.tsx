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

import { useDrawerStore } from "../drawerStore";
import { isLayerOpen } from "../overviewKeys";
import { isTyping } from "../overviewState";
import type { CanvasWorkspace } from "../useCanvasWorkspaces";
import { ChatDrawer } from "./ChatDrawer";
import { NewSessionDrawer } from "./NewSessionDrawer";
import { useStartSession } from "./useStartSession";
import {
  buildRouteContext,
  decideSend,
  findSession,
  afterPreviewSend,
  omniboxKeyAction,
  textAfter,
  type PreviewItem,
} from "./omniboxLogic";
import { ModeIcon } from "../ModeVisuals";
import { changeMode, MODES, type SessionMode } from "../sessionMode";
import { modeOf as storedModeOf, useSessionModeStore } from "../sessionModeStore";
import { useOmniboxDraftStore } from "./omniboxDraftStore";
import { routeMessage, targetLabel } from "./routeMessage";
import { useSessionSend } from "./useSessionSend";
import { ComposerVoiceControl } from "../../voice/ComposerVoiceControl";
import { useVoiceSettings } from "../../voice/voiceSettings";
import { insertAt } from "./voiceBack";
import { DrawerReplySpeaker, useKeyMomentSpeech, VoiceBackButton } from "./VoiceBack";
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
  const drawerKey = useDrawerStore((state) => state.sessionKey);
  const setDrawerKey = useDrawerStore((state) => state.open);
  const draftKey = useDrawerStore((state) => state.draftWorkspaceKey);
  const startSession = useStartSession();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  // Dictation in flight: the caret it will land at, and whether the mic is hearing.
  const [listening, setListening] = useState(false);
  const anchorRef = useRef<number | null>(null);
  const [sends, setSends] = useState(0);
  const voiceEnabled = useVoiceSettings().settings.enabled;
  useKeyMomentSpeech(workspaces);
  const draft = useOmniboxDraftStore((state) => state.draft);
  const [seenDraft, setSeenDraft] = useState<string | null>(null);

  if (draft !== null && draft !== seenDraft) {
    setSeenDraft(draft);
    setText(draft);
  } else if (draft === null && seenDraft !== null) {
    setSeenDraft(null);
  }

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- focuses the input and clears the store entry after another screen (the Kit) put text there
  useEffect(() => {
    if (draft === null) return;
    inputRef.current?.focus();
    useOmniboxDraftStore.getState().setDraft(null);
  }, [draft]);

  const ctx = buildRouteContext({
    workspaces,
    view: overview ? "overview" : "workspace",
    selectedKey,
    pinned,
    modeOf,
  });
  const drawer = drawerKey ? findSession(workspaces, drawerKey) : null;
  const previewOpen = preview !== null;
  const pinValid = pinned !== undefined && findSession(workspaces, pinned) !== null;

  // The preview only exists in the overview, for sessions that are still there.
  if (preview) {
    const live = preview.items.filter((item) => findSession(workspaces, item.sessionId));
    if (!overview || live.length === 0) setPreview(null);
    else if (live.length !== preview.items.length) setPreview({ ...preview, items: live });
  }

  // Capture phase and preventDefault: the overview's Esc handler skips defaultPrevented keys,
  // so one Esc closes only this layer.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- window key listener for "/" and Esc
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = omniboxKeyAction({
        key: event.key,
        mod: event.metaKey || event.ctrlKey || event.altKey,
        typing: isTyping(event.target),
        inOmnibox: event.target === inputRef.current,
        previewOpen: previewOpen,
        drawerOpen: drawerKey !== null,
        layerOpen: event.key === "Escape" && isLayerOpen(),
      });
      if (action === null) return;
      event.preventDefault();
      if (action === "focus") inputRef.current?.focus();
      else if (action === "close-preview") setPreview(null);
      else if (action === "close-drawer") useDrawerStore.getState().close();
      else inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [drawerKey, previewOpen]);

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

  /** Resolves whether the command or send went through; only then is the input cleared. */
  const runDecision = async (): Promise<boolean> => {
    // An open "New session" draft takes the first message.
    const draftWorkspace = workspaces.find((workspace) => workspace.key === draftKey);
    if (draftWorkspace) {
      const failure = await startSession(draftWorkspace, text.trim());
      if (failure !== null) toast("error", "Could not start the session", failure);
      return failure === null;
    }
    const decision = decideSend(text, ctx);
    if (decision.kind === "preview") {
      if (decision.items.length === 0) toast("info", "No workspace has a session to send to");
      else setPreview({ text: decision.text, items: decision.items });
      return false;
    }
    if (decision.kind === "send") {
      const ok = await sendTo(decision.workspaceKey, decision.sessionId, decision.text);
      if (ok) setDrawerKey(decision.sessionId);
      return ok;
    }
    const { command } = decision;
    if (command.kind === "setMode") {
      const hit = findSession(workspaces, command.sessionId);
      if (!hit) {
        toast("error", "That session is gone", "No live session matches; nothing was changed.");
        return false;
      }
      const error = await changeMode({
        from: modeOf(command.sessionId),
        to: command.mode,
        store: (value) => useSessionModeStore.getState().setMode(command.sessionId, value),
        send: async (message) => {
          const failure = await sendToSession(hit.pill.environmentId, hit.pill.threadId, message);
          return failure === null ? null : new Error(failure);
        },
      });
      if (error === null) return true;
      toast(
        "error",
        `Could not change ${hit.pill.title} to ${MODES[command.mode].label}`,
        error.message,
      );
      return false;
    }
    if (command.kind === "newWorkspace") {
      openCommandPalette({ open: "add-project" });
      toast(
        "info",
        `Create the folder for ${command.name}, then add it`,
        "Opened Add project; the canvas cannot create folders yet.",
      );
      return true;
    }
    if (command.kind === "briefMe") {
      const { target } = routeMessage("", ctx);
      if ("all" in target || target.sessionId === null) {
        toast("info", "Nothing to brief on yet");
        return false;
      }
      setDrawerKey(target.sessionId);
      return true;
    }
    toast("info", "The tour comes later");
    return true;
  };

  const submit = () => {
    if (busy || listening || text.trim() === "") return;
    setSends((count) => count + 1);
    setBusy(true);
    void runDecision()
      .then((ok) => setText((current) => textAfter(current, ok)))
      .finally(() => setBusy(false));
  };

  const confirmPreview = () => {
    if (!preview || busy) return;
    const { items, text: message } = preview;
    setSends((count) => count + 1);
    setBusy(true);
    void Promise.all(items.map((item) => sendTo(item.workspaceKey, item.sessionId, message)))
      .then((results) => {
        const { remaining, clearInput } = afterPreviewSend(items, results);
        setText((current) => textAfter(current, clearInput));
        if (remaining.length === 0) setPreview(null);
        else {
          setPreview({ text: message, items: remaining });
          toast("error", `Could not send to ${remaining.length} of ${items.length} workspaces`);
        }
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
      {draftKey !== null && workspaces.some((workspace) => workspace.key === draftKey) ? (
        <NewSessionDrawer
          workspace={workspaces.find((workspace) => workspace.key === draftKey)!}
          onClose={() => useDrawerStore.getState().close()}
        />
      ) : null}
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
      {drawer ? <DrawerReplySpeaker key={drawer.pill.key} pill={drawer.pill} /> : null}
      <div data-cv-bar="">
        <span data-cvo-mic="">
          <ComposerVoiceControl
            resetKey={`${targetLabel(ctx)}:${sends}`}
            disabled={busy}
            onProvisionalStart={() => {
              anchorRef.current = inputRef.current?.selectionStart ?? text.length;
              setListening(true);
            }}
            onProvisionalText={() => {}}
            onProvisionalEnd={() => {
              anchorRef.current = null;
              setListening(false);
            }}
            onTranscript={(heard) => {
              const anchor = anchorRef.current ?? inputRef.current?.selectionStart ?? text.length;
              anchorRef.current = null;
              setListening(false);
              setText((current) => insertAt(current, anchor, heard));
              return true;
            }}
          />
          {voiceEnabled ? (
            <svg data-cvo-hex="" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M8 1.2 13.9 4.6v6.8L8 14.8 2.1 11.4V4.6Z"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M5.4 8v0M8 6.2v3.6M10.6 7v2" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : null}
        </span>
        {targetMode ? (
          <span data-cv-mtag="" data-mode={targetMode}>
            <ModeIcon mode={targetMode} />
            {MODES[targetMode].label}
          </span>
        ) : null}
        <input
          ref={inputRef}
          data-cv-in=""
          placeholder={listening ? "Hex is listening…" : "Tell any session…"}
          aria-label="Omnibox"
          value={text}
          readOnly={listening}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229
            ) {
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
        <VoiceBackButton />
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
