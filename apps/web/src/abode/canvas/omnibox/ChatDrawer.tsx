import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Option } from "effect";

import ChatMarkdown from "~/components/ChatMarkdown";
import { useQuietThreadShell } from "~/state/entities";
import { useEnvironmentThread } from "~/state/threads";

import { drawerStatus, modelChipText } from "../drawerModel";
import { InterruptCard } from "../ModeBlocks";
import { ModeDial } from "../ModeButton";
import { currentMilestoneName, planBlock } from "../planBlock";
import type { SessionPill } from "../sessionPills";
import { usePlanFile } from "../usePlanFile";
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

/** Recent messages of the bound thread, with a pending approval or question answerable in place. */
function Messages(props: {
  readonly pill: SessionPill;
  readonly cwd: string | undefined;
  readonly onOpenFull: () => void;
}) {
  const { pill, cwd } = props;
  const state = useEnvironmentThread(pill.environmentId, pill.threadId);
  const projection = Option.getOrNull(state.data);
  const recent = (projection?.messages ?? [])
    .filter((message) => message.role !== "system" && message.text.trim() !== "")
    .slice(-RECENT);
  const threadRef = scopeThreadRef(pill.environmentId, pill.threadId);
  const pending =
    pill.pending !== null ? (
      <div data-cvo-ask="">
        <InterruptCard pill={pill} onOpen={props.onOpenFull} />
      </div>
    ) : null;
  if (recent.length === 0) {
    return (
      <div data-cvo-body="">
        {pending}
        <p data-cvo-empty="">{projection ? "No messages yet." : "Loading…"}</p>
      </div>
    );
  }
  // Newest first in the DOM; column-reverse keeps the bottom in view without scroll code.
  return (
    <div data-cvo-body="">
      {pending}
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
  const planFile = usePlanFile(pill.environmentId, props.cwd, `${pill.running}|${pill.status}`);
  const milestone = planFile.pending ? undefined : currentMilestoneName(planBlock(planFile));
  const status = drawerStatus(pill);
  return (
    <section
      data-cvo-drawer=""
      data-mode={mode}
      role="region"
      aria-label={`Chat with ${props.workspaceName} · ${pill.title}`}
    >
      <header data-cvo-dh="">
        <i data-cvo-sd="" data-state={status} aria-hidden />
        <span data-cvo-dlab="">chat with</span>
        <b>
          {props.workspaceName} · {pill.title}
        </b>
        <span data-cv-mt="" data-cvo-model="">
          <i data-provider={pill.dots[0] ?? "other"} aria-hidden />
          {modelChipText(pill, shell?.modelSelection.model ?? "")}
        </span>
        <span data-cvo-ms="">{milestone ? `${milestone} · ${status}` : status}</span>
        <span data-cvo-grow="" />
        <ModeDial pill={pill} mode={mode} />
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
      <Messages pill={pill} cwd={props.cwd} onOpenFull={props.onOpenFull} />
    </section>
  );
}
