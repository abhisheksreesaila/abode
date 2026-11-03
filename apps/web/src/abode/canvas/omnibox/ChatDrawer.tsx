import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Option } from "effect";

import ChatMarkdown from "~/components/ChatMarkdown";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentThread } from "~/state/threads";

import type { SessionPill } from "../sessionPills";
import type { SessionMode } from "./routeMessage";

const RECENT = 8;

export interface DrawerProps {
  readonly workspaceName: string;
  readonly cwd: string | undefined;
  readonly pill: SessionPill;
  readonly mode: SessionMode;
  readonly pinned: boolean;
  readonly onTogglePin: () => void;
  readonly onOpenFull: () => void;
  readonly onClose: () => void;
}

/** Recent messages of the bound thread; streaming text updates in place. */
function Messages(props: { readonly pill: SessionPill; readonly cwd: string | undefined }) {
  const { pill, cwd } = props;
  const state = useEnvironmentThread(pill.environmentId, pill.threadId);
  const projection = Option.getOrNull(state.data);
  const recent = (projection?.messages ?? [])
    .filter((message) => message.role !== "system" && message.text.trim() !== "")
    .slice(-RECENT);
  const threadRef = scopeThreadRef(pill.environmentId, pill.threadId);
  if (recent.length === 0) {
    return (
      <div data-cvo-body="">
        <p data-cvo-empty="">{projection ? "No messages yet." : "Loading…"}</p>
      </div>
    );
  }
  // Newest first in the DOM; column-reverse keeps the bottom in view without scroll code.
  return (
    <div data-cvo-body="">
      {recent.toReversed().map((message) =>
        message.role === "user" ? (
          <div key={message.id} data-cvo-msg="me">
            {message.text}
          </div>
        ) : (
          <div key={message.id} data-cvo-msg="cl">
            <ChatMarkdown
              text={message.text}
              cwd={cwd}
              threadRef={threadRef}
              environmentId={pill.environmentId}
              isStreaming={message.streaming}
            />
          </div>
        ),
      )}
    </div>
  );
}

/** The chat drawer above the omnibox (spec 5.6). */
export function ChatDrawer(props: DrawerProps) {
  const { pill, mode } = props;
  const shell = useQuietThreadShell(scopeThreadRef(pill.environmentId, pill.threadId));
  const state = pill.running ? "running" : pill.status === null ? "idle" : pill.status;
  return (
    <section
      data-cvo-drawer=""
      data-mode={mode}
      role="region"
      aria-label={`Chat with ${props.workspaceName} · ${pill.title}`}
    >
      <header data-cvo-dh="">
        <i data-cvo-sd="" data-state={state} aria-hidden />
        <span data-cvo-dlab="">chat with</span>
        <b>
          {props.workspaceName} · {pill.title}
        </b>
        <span data-cv-mt="" data-cvo-model="">
          <i data-provider={pill.dots[0] ?? "other"} aria-hidden />
          {shell?.modelSelection.model ?? ""}
        </span>
        <span data-cvo-grow="" />
        <button
          type="button"
          data-cvo-x=""
          aria-label="Pin the bar to this session"
          aria-pressed={props.pinned}
          onClick={props.onTogglePin}
        >
          ⌖
        </button>
        <button type="button" data-cvo-x="" aria-label="Open full chat" onClick={props.onOpenFull}>
          ↗
        </button>
        <button type="button" data-cvo-x="" aria-label="Close chat" onClick={props.onClose}>
          ×
        </button>
      </header>
      <Messages pill={pill} cwd={props.cwd} />
    </section>
  );
}
