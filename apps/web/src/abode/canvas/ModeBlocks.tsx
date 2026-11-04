import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  derivePendingThreadRequests,
  type ThreadPendingApproval,
  type ThreadPendingUserInput,
} from "@t3tools/client-runtime/state/thread-requests";
import { AuthOrchestrationOperateScope, type ProviderApprovalOption } from "@t3tools/contracts";
import { useState } from "react";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import { useQuietThreadProjection } from "~/state/entities";
import { readEnvironmentScope } from "~/state/session";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { briefLines, statusSentence, type Block, type ComposeSession } from "./composeBlocks";
import { Ember, Pip } from "./ModeVisuals";
import { useSessionModeStore } from "./sessionModeStore";
import type { SessionPill } from "./sessionPills";

const EMBER_QUIPS = [
  "Let's start easy.",
  "No pressure. Okay, a little.",
  "Last one, I promise.",
  "Humour me.",
];
const PIP_QUIPS = [
  "Here's the short version.",
  "Quick update, no fuss.",
  "Nothing scary. Probably.",
];

/** A stable pick per session, so a quip does not change on every refresh. */
function quipFor(quips: ReadonlyArray<string>, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return quips[hash % quips.length]!;
}

const DEFAULT_APPROVAL_OPTIONS: ReadonlyArray<ProviderApprovalOption> = [
  { decision: "accept", label: "Approve" },
  { decision: "decline", label: "Decline" },
];

function reportFailure(title: string, error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : "An error occurred.",
    }),
  );
}

/**
 * The thread's structure (pending requests, resolved answers, messages), which holds through
 * streamed assistant text, so these cards do not re-render on every token.
 */
function useThreadDetail(pill: SessionPill) {
  const detail = useQuietThreadProjection(scopeThreadRef(pill.environmentId, pill.threadId));
  const projection = detail?.projection ?? null;
  if (projection === null) {
    return { approval: null, userInput: null, projection };
  }
  const pending = derivePendingThreadRequests(projection);
  return {
    approval: derivePendingApprovals(pending.approvals)[0] ?? null,
    userInput: derivePendingUserInputs(pending.userInputs)[0] ?? null,
    projection,
  };
}

function QuestionChips(props: {
  readonly pill: SessionPill;
  readonly input: ThreadPendingUserInput;
  readonly onOpen: () => void;
}) {
  const { pill, input, onOpen } = props;
  const respond = useOrchestrationCommand(threadEnvironment.respondToUserInput, {
    reportFailure: false,
  });
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Record<string, unknown>>({});
  const [toggled, setToggled] = useState<ReadonlyArray<string>>([]);
  const [busy, setBusy] = useState(false);
  const question = input.questions[step];
  if (question === undefined) return null;
  const canOperate = readEnvironmentScope(pill.environmentId, AuthOrchestrationOperateScope);
  const answerable = input.responseCapability !== "not_resumable" && canOperate;

  const submit = async (value: string | ReadonlyArray<string>) => {
    const answers = { ...picked, [question.id]: value };
    setToggled([]);
    if (step + 1 < input.questions.length) {
      setPicked(answers);
      setStep(step + 1);
      return;
    }
    setBusy(true);
    const result = await respond({
      environmentId: pill.environmentId,
      input: { threadId: pill.threadId, requestId: input.requestId, answers },
    });
    setBusy(false);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      reportFailure("Could not send the answer", squashAtomCommandFailure(result));
    }
  };

  return (
    <>
      <h4 data-cv-q="">{question.question}</h4>
      {question.options.length > 0 && answerable ? (
        <div data-cv-chips="">
          {question.options.map((option) => {
            const value = option.value ?? option.label;
            return (
              <button
                key={option.label}
                type="button"
                data-cv-chip=""
                aria-pressed={question.multiSelect ? toggled.includes(value) : undefined}
                disabled={busy}
                onClick={() =>
                  question.multiSelect
                    ? setToggled(
                        toggled.includes(value)
                          ? toggled.filter((entry) => entry !== value)
                          : [...toggled, value],
                      )
                    : void submit(value)
                }
              >
                {option.label}
              </button>
            );
          })}
          {question.multiSelect ? (
            <button
              type="button"
              data-cv-chip=""
              data-primary=""
              disabled={busy || toggled.length === 0}
              onClick={() => void submit(toggled)}
            >
              Send
            </button>
          ) : null}
        </div>
      ) : null}
      <p data-cv-hint="">
        {!canOperate
          ? "This connection cannot answer. Open the chat."
          : answerable
            ? "or answer in the chat"
            : "This one can only be answered in the chat."}{" "}
        <button type="button" data-cv-link="" onClick={onOpen}>
          open chat
        </button>
      </p>
    </>
  );
}

function ApprovalButtons(props: {
  readonly pill: SessionPill;
  readonly approval: ThreadPendingApproval;
}) {
  const { pill, approval } = props;
  const respond = useOrchestrationCommand(threadEnvironment.respondToApproval, {
    reportFailure: false,
  });
  const [busy, setBusy] = useState(false);
  if (approval.responseCapability !== "live") {
    return <p data-cv-hint="">The agent can no longer take an answer to this one.</p>;
  }
  if (!readEnvironmentScope(pill.environmentId, AuthOrchestrationOperateScope)) {
    return <p data-cv-hint="">This connection cannot answer. Open the chat.</p>;
  }
  const choose = async (decision: ProviderApprovalOption["decision"]) => {
    setBusy(true);
    const result = await respond({
      environmentId: pill.environmentId,
      input: { threadId: pill.threadId, requestId: approval.requestId, decision },
    });
    setBusy(false);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      reportFailure("Could not send the decision", squashAtomCommandFailure(result));
    }
  };
  return (
    <div data-cv-chips="">
      {(approval.options ?? DEFAULT_APPROVAL_OPTIONS).map((option, index) => (
        <button
          key={option.decision}
          type="button"
          data-cv-chip=""
          data-primary={index === 0 ? "" : undefined}
          disabled={busy}
          onClick={() => void choose(option.decision)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function InterruptCard(props: { readonly pill: SessionPill; readonly onOpen: () => void }) {
  const { pill, onOpen } = props;
  const { approval, userInput } = useThreadDetail(pill);
  return (
    <div data-cv-block="interrupt" role="group" aria-label={`${pill.title} needs you`}>
      <div data-cv-lab="">
        {approval ? "Needs approval" : "Needs your answer"} · {pill.title}
      </div>
      {approval ? (
        <>
          <h4 data-cv-q="">{approval.detail ?? approval.reason ?? "Approval needed"}</h4>
          <ApprovalButtons key={approval.requestId} pill={pill} approval={approval} />
        </>
      ) : userInput ? (
        <QuestionChips key={userInput.requestId} pill={pill} input={userInput} onOpen={onOpen} />
      ) : (
        <p data-cv-hint="">
          Waiting on you.{" "}
          <button type="button" data-cv-link="" onClick={onOpen}>
            open chat
          </button>
        </p>
      )}
    </div>
  );
}

function GrillCard(props: { readonly pill: SessionPill; readonly onOpen: () => void }) {
  const { pill, onOpen } = props;
  const serious = useSessionModeStore((state) => state.serious);
  const { userInput } = useThreadDetail(pill);
  return (
    <div data-cv-block="grill" data-cv-hm="" role="group" aria-label={`Grill me, ${pill.title}`}>
      <Ember happy={userInput === null} />
      <div>
        {serious ? null : (
          <p data-cv-quip="">
            Ember: “{userInput === null ? "Nothing to ask. Yet." : quipFor(EMBER_QUIPS, pill.key)}”
          </p>
        )}
        <div data-cv-lab="">Grill me · {pill.title}</div>
        {userInput ? (
          <QuestionChips key={userInput.requestId} pill={pill} input={userInput} onOpen={onOpen} />
        ) : (
          <p data-cv-hint="">no question right now</p>
        )}
      </div>
    </div>
  );
}

function AnswersCard(props: { readonly pill: SessionPill }) {
  const { projection } = useThreadDetail(props.pill);
  const said = (projection?.runtimeRequests ?? [])
    .filter((request) => request.kind === "user_input" && request.status === "resolved")
    .flatMap((request) => Object.values(request.answers ?? {}))
    .map((answer) => (Array.isArray(answer) ? answer.join(", ") : String(answer)))
    .filter((answer) => answer.length > 0)
    .slice(-5);
  if (said.length === 0) return null;
  return (
    <div data-cv-block="answers">
      <div data-cv-lab="">What you've said</div>
      <ul>
        {said.map((answer, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- answers repeat; the list only grows at the end
          <li key={index}>{answer}</li>
        ))}
      </ul>
    </div>
  );
}

function BriefCard(props: { readonly pill: SessionPill; readonly onOpen: () => void }) {
  const { pill, onOpen } = props;
  const serious = useSessionModeStore((state) => state.serious);
  const { projection } = useThreadDetail(pill);
  const latest = projection?.messages.findLast(
    (message) =>
      message.role === "assistant" && !message.streaming && message.text.trim().length > 0,
  );
  const lines = latest ? briefLines(latest.text) : [];
  return (
    <div data-cv-block="sbrief" data-cv-hm="" role="group" aria-label={`Brief, ${pill.title}`}>
      <Pip worried={pill.status === "waiting on you" || pill.status === "blocked"} />
      <div>
        <div data-cv-lab="">Tell me · {pill.title}</div>
        {serious ? null : <p data-cv-quip="">Pip: “{quipFor(PIP_QUIPS, pill.key)}”</p>}
        {lines.length > 0 ? (
          lines.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p data-cv-hint="">nothing to report yet</p>
        )}
        <button type="button" data-cv-link="" onClick={onOpen}>
          open chat
        </button>
      </div>
    </div>
  );
}

/** One block of the composed body. The plan block is the caller's, since it owns the plan file. */
export function ModeBlock(props: {
  readonly block: Exclude<Block, { readonly block: "plan" | "side" }>;
  readonly pills: ReadonlyArray<SessionPill>;
  readonly sessions: ReadonlyArray<ComposeSession>;
  readonly onOpen: (pill: SessionPill) => void;
}) {
  const { block, pills, sessions, onOpen } = props;
  if (block.block === "status") {
    return (
      <p data-cv-block="status" data-cv-status="">
        {statusSentence(sessions)}
      </p>
    );
  }
  if (block.block === "made") {
    return (
      <p data-cv-block="made">
        <span data-cv-made-dot="" aria-hidden /> Autopilot is making calls on its own ·{" "}
        <em>reversible</em>
      </p>
    );
  }
  const pill = pills.find((candidate) => candidate.key === block.sessionKey);
  if (pill === undefined) return null;
  const open = () => onOpen(pill);
  switch (block.block) {
    case "interrupt":
      return <InterruptCard pill={pill} onOpen={open} />;
    case "grill":
      return <GrillCard pill={pill} onOpen={open} />;
    case "answers":
      return <AnswersCard pill={pill} />;
    case "sbrief":
      return <BriefCard pill={pill} onOpen={open} />;
    case "jamintro":
      return (
        <div data-cv-block="jamintro">
          <div data-cv-lab="">Jam · {pill.title}</div>
          <p>The live board arrives with design sessions.</p>
        </div>
      );
    case "chat":
      return (
        <div data-cv-block="chat">
          <div data-cv-lab="">Jam chat</div>
          <p data-cv-hint="">
            Talk it through in the chat for now.{" "}
            <button type="button" data-cv-link="" onClick={open}>
              open chat
            </button>
          </p>
        </div>
      );
  }
}
