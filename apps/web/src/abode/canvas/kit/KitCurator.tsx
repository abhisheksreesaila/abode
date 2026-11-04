import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { Option } from "effect";
import { useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { newMessageId, newThreadId } from "~/lib/utils";
import {
  deriveProviderInstanceEntries,
  getDefaultProviderInstanceModel,
  resolveSelectableProviderInstanceEntry,
} from "~/providerInstances";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useProjects, useServerConfigs } from "~/state/entities";
import { primaryServerProvidersAtom } from "~/state/server";
import { useEnvironmentThread, threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { useSessionSend } from "../omnibox/useSessionSend";
import { buildCuratorBrief, displayUserText, pickCuratorProject, type KitSkill } from "./kitModel";

const TITLE = "Kit curator";
const CURATE = "Curate my kit: find the overlaps, tell me what to drop and what's missing.";

interface CuratorThread {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly cwd: string;
}

/** Where the curator would run, or null when there is no project or no Claude to run it. */
function useCuratorTarget() {
  const projects = useProjects();
  const configs = useServerConfigs();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const providers = useAtomValue(primaryServerProvidersAtom);
  const project = pickCuratorProject(
    projects.filter(
      (entry) =>
        entry.environmentId === primaryEnvironmentId &&
        !isScratchProject(entry, configs.get(entry.environmentId)?.scratchWorkspaceRoot),
    ),
  );
  const claude = resolveSelectableProviderInstanceEntry(
    deriveProviderInstanceEntries(providers).filter((entry) => entry.driverKind === "claudeAgent"),
    undefined,
  );
  const model = claude ? getDefaultProviderInstanceModel(providers, claude.instanceId) : undefined;
  if (!project || !claude || !model) return null;
  return { project, modelSelection: { instanceId: claude.instanceId, model } };
}

function Conversation(props: { readonly thread: CuratorThread }) {
  const { thread } = props;
  const state = useEnvironmentThread(thread.environmentId, thread.threadId);
  const messages = (Option.getOrNull(state.data)?.messages ?? []).filter(
    (message) => message.role !== "system" && message.text.trim() !== "",
  );
  const threadRef = scopeThreadRef(thread.environmentId, thread.threadId);
  const waiting = messages.at(-1)?.role !== "assistant";
  return (
    <div data-cvk-msgs="">
      {messages.map((message) =>
        message.role === "user" ? (
          <div key={message.id} data-cvk-msg="me">
            {displayUserText(message.text)}
          </div>
        ) : (
          <div key={message.id} data-cvk-msg="cl">
            <ChatMarkdown
              text={message.text}
              cwd={thread.cwd}
              threadRef={threadRef}
              environmentId={thread.environmentId}
              isStreaming={message.streaming}
            />
          </div>
        ),
      )}
      {waiting ? <span data-cvk-hint="">Claude is reading your kit…</span> : null}
    </div>
  );
}

/** The centre column: Claude Code curating, as a real thread in the user's home (or primary) project. */
export function KitCurator(props: {
  readonly skills: ReadonlyArray<KitSkill>;
  readonly mcpServers: number;
  readonly onShowDesign: () => void;
}) {
  const { skills, mcpServers } = props;
  const target = useCuratorTarget();
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  const sendFollowUp = useSessionSend();
  const [thread, setThread] = useState<CuratorThread | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (request: string) => {
    const trimmed = request.trim();
    if (trimmed === "" || busy || !target) return;
    setBusy(true);
    setError(null);
    const run = async () => {
      if (thread) return sendFollowUp(thread.environmentId, thread.threadId, trimmed);
      const { project, modelSelection } = target;
      const threadId = newThreadId();
      const createdAt = new Date().toISOString();
      const result = await startTurn({
        environmentId: project.environmentId,
        input: {
          threadId,
          message: {
            messageId: newMessageId(),
            role: "user",
            text: buildCuratorBrief({ skills, mcpServers, request: trimmed }),
            attachments: [],
          },
          modelSelection,
          titleSeed: TITLE,
          runtimeMode: "approval-required",
          interactionMode: "default",
          bootstrap: {
            createThread: {
              projectId: project.id,
              title: TITLE,
              modelSelection,
              runtimeMode: "approval-required",
              interactionMode: "default",
              branch: null,
              worktreePath: null,
              createdAt,
            },
          },
          createdAt,
        },
      });
      if (result._tag === "Success") {
        setThread({
          environmentId: project.environmentId,
          threadId,
          cwd: project.workspaceRoot,
        });
        return null;
      }
      const failure = squashAtomCommandFailure(result);
      return failure instanceof Error ? failure.message : "Could not start the curator.";
    };
    const failure = await run();
    setBusy(false);
    if (failure === null) setText("");
    else setError(failure);
  };

  const input = (
    <div data-cvk-row="">
      <input
        data-cvk-in=""
        aria-label="Ask the curator"
        placeholder="Ask the curator: “which skills overlap?”, “what am I missing for design?”"
        value={text}
        disabled={!target || busy}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void ask(text);
        }}
      />
      <button
        type="button"
        data-cvk-btn="fill"
        disabled={!target || busy || text.trim() === ""}
        onClick={() => void ask(text)}
      >
        Ask
      </button>
    </div>
  );

  const who = (
    <div data-cvk-who="">
      <span data-cvk-cl="">✳</span>
      <b>Claude Code</b>
      <span>curating</span>
    </div>
  );

  if (thread) {
    return (
      <div data-cvk-card="">
        {who}
        <Conversation thread={thread} />
        {error ? <div data-cvk-error="">{error}</div> : null}
        {input}
        <div data-cvk-row="foot">
          <button type="button" data-cvk-btn="" onClick={() => setThread(null)}>
            New conversation
          </button>
          <span data-cvk-hint="">it proposes; nothing changes until you say yes</span>
        </div>
      </div>
    );
  }

  const sources = new Set(skills.map((skill) => skill.source)).size;
  return (
    <div data-cvk-card="intro">
      {who}
      <h2>
        {skills.length} skills from {sources} {sources === 1 ? "source" : "sources"}.
      </h2>
      <p>
        Packs overlap a lot: tdd, review and debugging each show up two or three times. I'll look at
        your kit, say which skills do the same job, label where every one came from and what kind it
        is, and suggest what's missing. Nothing is installed, edited or removed until you say so.
      </p>
      <div data-cvk-row="">
        <button
          type="button"
          data-cvk-btn="fill"
          disabled={!target || busy}
          onClick={() => void ask(CURATE)}
        >
          Curate with me
        </button>
        <button type="button" data-cvk-btn="" onClick={props.onShowDesign}>
          What design skills do I have?
        </button>
      </div>
      {input}
      {error ? <div data-cvk-error="">{error}</div> : null}
      {target ? null : (
        <div data-cvk-note="">
          No project to run the curator in yet. Add a project, then ask again.
        </div>
      )}
    </div>
  );
}
