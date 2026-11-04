import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { useState } from "react";

import { useNewThreadHandler } from "~/hooks/useHandleNewThread";

import type { CanvasWorkspace } from "../useCanvasWorkspaces";
import { useStartSession } from "./useStartSession";

/** The "New session" draft above the omnibox: nothing exists until the first message is sent. */
export function NewSessionDrawer(props: {
  readonly workspace: CanvasWorkspace;
  readonly onClose: () => void;
}) {
  const { workspace } = props;
  const startSession = useStartSession();
  const handleNewThread = useNewThreadHandler();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    if (busy || text.trim() === "") return;
    setBusy(true);
    setError(null);
    void startSession(workspace, text.trim())
      .then((failure) => setError(failure))
      .finally(() => setBusy(false));
  };

  // The full chat route is reached from here only, like the session drawer's open-full button.
  const openFull = () => {
    const target = workspace.newSessionTarget;
    if (target === undefined) return;
    props.onClose();
    void handleNewThread(scopeProjectRef(target.environmentId, target.id));
  };

  return (
    <section
      data-cvo-drawer=""
      data-mode="auto"
      role="region"
      aria-label={`New session in ${workspace.name}`}
    >
      <header data-cvo-dh="">
        <i data-cvo-sd="" data-state="idle" aria-hidden />
        <span data-cvo-dlab="">new session in</span>
        <b>{workspace.name}</b>
        <span data-cvo-grow="" />
        <button type="button" data-cvo-x="" aria-label="Open full chat" onClick={openFull}>
          ↗
        </button>
        <button type="button" data-cvo-x="" aria-label="Close new session" onClick={props.onClose}>
          ×
        </button>
      </header>
      <div data-cvo-body="">
        <div data-cvo-newrow="">
          <input
            data-cvo-newin=""
            placeholder="What should this session work on?"
            aria-label="First message"
            value={text}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            data-cvo-btn="primary"
            disabled={busy || text.trim() === ""}
            onClick={send}
          >
            Start
          </button>
        </div>
        <p data-cvo-empty="">
          {error ?? "The session starts with your first message. You can also use the bar below."}
        </p>
      </div>
    </section>
  );
}
