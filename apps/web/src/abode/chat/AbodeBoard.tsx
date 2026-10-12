import { useAtomValue } from "@effect/atom-react";
import { MessageId, type ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { resolveSidebarThreadStatus } from "~/components/Sidebar.logic";
import { assistantCitationNavigation } from "~/lib/assistantCitationNavigation";
import { newMessageId } from "~/lib/utils";
import { getProviderInstanceEntry } from "~/providerInstances";
import { primaryServerProvidersAtom } from "~/state/server";
import { useThreadShell, useThreadVisibleTurnItems } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { buildBoard, type BoardEntry, type BoardSourceItem } from "./boardModel";
import { BossAvatar, HelperAvatar, type Helper } from "./cast/Characters";
import { useCastStore } from "./cast/castStore";
import { activityPose, helperMood, type HelperStatus, type Pose } from "./mood";
import { PoseProps } from "./PoseProps";
import "./board.css";

const ACTIVITY_TYPES = new Set([
  "file_change",
  "command_execution",
  "file_search",
  "web_search",
  "reasoning",
  "subagent",
  "dynamic_tool",
]);

function helperFor(driverKind: string | undefined): Helper {
  return driverKind === "codex" ? "pip" : "sunny";
}

function toStatus(status: ReturnType<typeof resolveSidebarThreadStatus>): HelperStatus {
  return status === "approval" ||
    status === "input" ||
    status === "working" ||
    status === "failed" ||
    status === "limited"
    ? status
    : null;
}

/** A short plain-text quote from a card, for finding it again in the rendered message. */
export function quoteFor(text: string): string {
  const plain = text
    .replace(/[*_`#>[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain
    .split(/(?<=[.!?])\s/)[0]!
    .slice(0, 80)
    .trim();
}

/**
 * The right-hand column of the abode chat: the helper with its mood and pose, then every
 * card in the thread sorted into lanes. Server threads only; drafts have no answers yet.
 */
export function AbodeBoard(props: { readonly threadRef: ScopedThreadRef | null }) {
  const enabled = useCastStore((state) => state.enabled);
  if (!enabled || props.threadRef === null) return null;
  return <Board threadRef={props.threadRef} />;
}

function Board({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const shell = useThreadShell(threadRef);
  const projected = useThreadVisibleTurnItems(threadRef);
  const providers = useAtomValue(primaryServerProvidersAtom);
  const navigate = useNavigate();
  const cast = useCastStore(
    useShallow((state) => ({
      look: state.look,
      photo: state.photo,
      bossName: state.bossName,
      claudeName: state.claudeName,
      codexName: state.codexName,
    })),
  );
  // Failures surface as upstream's own error toast.
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn);
  const [sending, setSending] = useState(false);
  const [answered, setAnswered] = useState<{ messageId: string; choice: string } | null>(null);
  const columnRef = useRef<HTMLElement>(null);
  const avatarsRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => projected.map((entry) => entry.item), [projected]);
  const board = useMemo(() => buildBoard(items as ReadonlyArray<BoardSourceItem>), [items]);
  const latestAnswer = useMemo(
    () => items.findLast((item) => item.type === "assistant_message"),
    [items],
  );
  const latestActivity = useMemo(
    () => items.findLast((item) => ACTIVITY_TYPES.has(item.type)) ?? null,
    [items],
  );
  const latestAnswerId = latestAnswer?.type === "assistant_message" ? latestAnswer.messageId : null;
  const agreed = answered !== null && answered.messageId === latestAnswerId ? answered : null;

  const helper = helperFor(
    shell
      ? getProviderInstanceEntry(providers, shell.modelSelection.instanceId)?.driverKind
      : undefined,
  );
  const helperName = helper === "pip" ? cast.codexName : cast.claudeName;
  const status = shell ? toStatus(resolveSidebarThreadStatus(shell)) : null;
  const latestWarnings = board.watchOut.filter(
    (entry) => entry.messageId === latestAnswerId,
  ).length;
  const mood = helperMood({
    status,
    openQuestions: agreed ? 0 : board.needsYou.length,
    latestWarnings,
    hasAnswer: latestAnswerId !== null,
    agreedChoice: agreed?.choice ?? null,
  });
  const pose: Pose | null = mood.working
    ? activityPose(
        latestActivity === null
          ? null
          : {
              type: latestActivity.type,
              ...(latestActivity.type === "subagent" ? { prompt: latestActivity.prompt } : {}),
            },
      )
    : null;

  // The timeline's avatars are CSS backgrounds; hand it the drawings as data URLs.
  // The signature changes whenever a drawing does, which re-reads the hidden copies.
  // Copy the hidden drawings onto the chat's container when they change; the container is
  // also the size container that hides the board when the chat gets narrow.
  const drawingSignature = JSON.stringify([helper, cast, helperName]);
  const handedOver = useRef("");
  useLayoutEffect(() => {
    const host = columnRef.current?.parentElement;
    const drawings = avatarsRef.current?.children;
    if (!host || !drawings || drawings.length < 2 || handedOver.current === drawingSignature)
      return;
    handedOver.current = drawingSignature;
    const asUrl = (element: Element) =>
      element instanceof HTMLImageElement
        ? `url("${element.src}")`
        : `url("data:image/svg+xml,${encodeURIComponent(
            element.outerHTML.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'),
          )}")`;
    host.style.setProperty("--abode-helper-avatar", asUrl(drawings[0]!));
    host.style.setProperty("--abode-boss-avatar", asUrl(drawings[1]!));
  }, [drawingSignature]);
  useLayoutEffect(() => {
    const host = columnRef.current?.parentElement;
    host?.style.setProperty("container-type", "inline-size");
    return () => {
      handedOver.current = "";
      host?.style.removeProperty("container-type");
      host?.style.removeProperty("--abode-helper-avatar");
      host?.style.removeProperty("--abode-boss-avatar");
    };
  }, []);

  /** Scrolls to a rendered message, or asks the timeline to find the quote in older history. */
  const jumpTo = (messageId: string, text: string) => {
    const row = document.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(messageId)}"][data-message-role="assistant"]`,
    );
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const quote = quoteFor(text);
    if (quote === "") return;
    void navigate(
      assistantCitationNavigation({
        version: 1,
        environmentId: threadRef.environmentId,
        threadId: threadRef.threadId,
        messageId: MessageId.make(messageId),
        text: quote,
        start: 0,
        end: quote.length,
        prefix: "",
        suffix: "",
      }),
    );
  };

  const answer = async (entry: BoardEntry, choice: string) => {
    if (!shell || sending) return;
    setSending(true);
    const result = await startTurn({
      environmentId: threadRef.environmentId,
      input: {
        threadId: threadRef.threadId,
        message: { messageId: newMessageId(), role: "user", text: choice, attachments: [] },
        modelSelection: shell.modelSelection,
        titleSeed: shell.title,
        runtimeMode: shell.runtimeMode,
        interactionMode: shell.interactionMode,
        createdAt: new Date().toISOString(),
      },
    });
    setSending(false);
    if (result._tag === "Success") setAnswered({ messageId: entry.messageId, choice });
  };

  return (
    <aside ref={columnRef} data-abode-board="" aria-label="Board">
      <div ref={avatarsRef} hidden>
        <HelperAvatar helper={helper} name={helperName} />
        <BossAvatar look={cast.look} photo={cast.photo} name={cast.bossName} />
      </div>
      <header data-abode-board-hero="">
        <HelperAvatar
          helper={helper}
          name={helperName}
          mood={mood.mark}
          className="size-16 shrink-0"
        >
          {pose ? <PoseProps pose={pose} key={latestActivity?.id ?? "none"} /> : null}
        </HelperAvatar>
        <p>
          <b>{helperName}</b> {mood.headline}
        </p>
      </header>
      <div data-abode-board-lanes="">
        {status === "approval" || status === "input" ? (
          <Lane kind="question" title="Needs you" count={1}>
            <div data-abode-tile="">
              {status === "approval"
                ? "Waiting for your OK in the box below the chat."
                : "Answer the question in the box below the chat."}
            </div>
          </Lane>
        ) : null}
        {agreed ? (
          <Lane kind="question" title="Needs you" count={0}>
            <div data-abode-agreed="" role="status">
              <span aria-hidden>👍</span> {agreed.choice} · on it
            </div>
          </Lane>
        ) : board.needsYou.length > 0 ? (
          <Lane kind="question" title="Needs you" count={board.needsYou.length}>
            {board.needsYou.map((entry) => (
              <div key={entry.key} data-abode-tile="">
                <CardText entry={entry} onJump={jumpTo} />
                {entry.card.options.length > 0 ? (
                  <div data-abode-answers="">
                    {entry.card.options.map((option, index) => (
                      <button
                        key={option}
                        type="button"
                        disabled={sending}
                        data-primary={index === 0 || undefined}
                        onClick={() => void answer(entry, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </Lane>
        ) : null}
        {board.watchOut.length > 0 ? (
          <Lane kind="warning" title="Watch out" count={board.watchOut.length}>
            {board.watchOut.map((entry) => (
              <div key={entry.key} data-abode-tile="">
                <CardText entry={entry} onJump={jumpTo} />
              </div>
            ))}
          </Lane>
        ) : null}
        {board.tickets.length > 0 ? (
          <Lane kind="tickets" title="Tickets" count={board.tickets.length}>
            {board.tickets.map((entry) => (
              <button
                key={entry.key}
                type="button"
                data-abode-tile=""
                data-abode-ticket=""
                onClick={() => jumpTo(entry.messageId, `${entry.ticket.id} ${entry.ticket.title}`)}
              >
                <code>{entry.ticket.id}</code> {entry.ticket.title}
              </button>
            ))}
          </Lane>
        ) : null}
        {board.done.length > 0 ? (
          <Lane kind="done" title="Done" count={board.done.length}>
            {board.done.map((entry) => (
              <div key={entry.key} data-abode-tile="" data-abode-done="">
                <CardText entry={entry} onJump={jumpTo} />
              </div>
            ))}
          </Lane>
        ) : null}
        {board.isEmpty && status !== "approval" && status !== "input" && !agreed ? (
          <p data-abode-board-empty="">
            Questions, warnings, tickets and wins from {helperName}'s answers collect here.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function Lane(props: {
  readonly kind: "question" | "warning" | "tickets" | "done";
  readonly title: string;
  readonly count: number;
  readonly children: React.ReactNode;
}) {
  return (
    <section data-abode-lane={props.kind} aria-label={props.title}>
      <h3>
        {props.title}
        {props.count > 0 ? <span>{props.count}</span> : null}
      </h3>
      {props.children}
    </section>
  );
}

/** A card's title and first lines; the whole tile jumps back to its message. */
function CardText(props: {
  readonly entry: BoardEntry;
  readonly onJump: (messageId: string, text: string) => void;
}) {
  const { entry } = props;
  const text = [entry.card.title, entry.card.body].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      data-abode-card-text=""
      onClick={() => props.onJump(entry.messageId, entry.card.body || entry.card.title || "")}
    >
      {text.replace(/[*_`#>]/g, "").slice(0, 280)}
    </button>
  );
}
