import {
  ApprovalRequestId,
  CommandId,
  MessageId,
  UserInputRequestedPayload,
  type OrchestrationEvent,
  type OrchestrationSessionStatus,
  type ThreadAutonomousStopReason,
  type ThreadId,
} from "@t3tools/contracts";
import { makeDrainableWorker } from "@t3tools/shared/DrainableWorker";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import { forkParked } from "../serverActivation.ts";
import * as OrchestrationEngine from "./Services/OrchestrationEngine.ts";
import * as ProjectionSnapshotQuery from "./Services/ProjectionSnapshotQuery.ts";
import { ProviderRuntimeIngestionService } from "./Services/ProviderRuntimeIngestion.ts";
import {
  AUTONOMOUS_ASSUME_ANSWER,
  autoContinueMessageText,
  decideAutoContinue,
  finalAssistantTextSinceLastUserMessage,
} from "./ThreadAutonomousPolicy.ts";

/**
 * Keeps an autonomous thread going. When a turn ends without the done marker,
 * the thread is nudged with an ordinary user turn, up to the thread's cap.
 * The decision itself is `decideAutoContinue`; this service owns when to ask
 * and how to act on the answer. Every nudge goes through the normal
 * `thread.turn.start` path, so provider usage limits apply as usual.
 */
export class ThreadAutonomousReactor extends Context.Service<
  ThreadAutonomousReactor,
  {
    readonly start: () => Effect.Effect<void, never, Scope.Scope>;
    readonly drain: Effect.Effect<void>;
  }
>()("t3/orchestration/ThreadAutonomousReactor") {}

type WorkItem =
  | { readonly kind: "turn-ended"; readonly threadId: ThreadId }
  /** Autonomous was just turned on; an idle thread continues right away. */
  | { readonly kind: "enabled"; readonly threadId: ThreadId }
  | { readonly kind: "interrupt-requested"; readonly threadId: ThreadId }
  | {
      readonly kind: "user-input";
      readonly threadId: ThreadId;
      readonly requestId: string;
      readonly payload: unknown;
    };

const decodeUserInputRequested = Schema.decodeUnknownOption(UserInputRequestedPayload);

const TURN_ENDED_STATUSES: ReadonlySet<OrchestrationSessionStatus> = new Set([
  "ready",
  "interrupted",
  "error",
  "stopped",
]);

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const engine = yield* OrchestrationEngine.OrchestrationEngineService;
  const snapshots = yield* ProjectionSnapshotQuery.ProjectionSnapshotQuery;
  const ingestion = yield* ProviderRuntimeIngestionService;
  const crypto = yield* Crypto.Crypto;

  // The last session status seen per thread. A turn has ended only when a
  // running or starting session settles, so a session that merely reports
  // ready (provider start-up, resume) never triggers a nudge.
  const lastStatus = new Map<ThreadId, OrchestrationSessionStatus>();

  const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

  const commandId = (threadId: ThreadId, tag: string) =>
    Effect.map(crypto.randomUUIDv4, (uuid) =>
      CommandId.make(`server:autonomous:${tag}:${threadId}:${uuid}`),
    );

  const stop = Effect.fn("ThreadAutonomousReactor.stop")(function* (
    threadId: ThreadId,
    reason: ThreadAutonomousStopReason,
    detail: string | null,
  ) {
    yield* engine.dispatch({
      type: "thread.meta.update",
      commandId: yield* commandId(threadId, "stop"),
      threadId,
      autonomous: { enabled: false, stopReason: reason, stopDetail: detail },
    });
  });

  const evaluate = Effect.fn("ThreadAutonomousReactor.evaluate")(function* (
    item: Extract<WorkItem, { kind: "turn-ended" | "enabled" }>,
  ) {
    if (item.kind === "turn-ended") {
      // The session settles before the ingestion worker finalizes the turn's
      // last assistant message. Wait for it so the done marker is visible.
      yield* ingestion.drain;
    }
    const detail = yield* snapshots.getThreadDetailById(item.threadId);
    if (Option.isNone(detail)) return;
    const thread = detail.value;
    const state = thread.autonomous;
    if (state?.enabled !== true) return;
    if (item.kind === "enabled" && !thread.messages.some((message) => message.role === "user")) {
      // Nothing to continue yet; the first turn's end starts the loop.
      return;
    }

    const rawStatus = thread.session?.status ?? "idle";
    // Turning it back on after a stop leaves the old error or interrupted
    // session behind; that is not a fresh failure, so treat it as idle.
    const sessionStatus =
      item.kind === "enabled" && rawStatus !== "running" && rawStatus !== "starting"
        ? "ready"
        : rawStatus;
    const latestTurnId = thread.latestTurn?.turnId ?? null;
    const decision = decideAutoContinue({
      state,
      sessionStatus,
      lastError: thread.session?.lastError ?? null,
      finalAssistantText: finalAssistantTextSinceLastUserMessage(thread.messages),
      planAwaitingApproval:
        thread.interactionMode === "plan" &&
        latestTurnId !== null &&
        thread.proposedPlans.some(
          (plan) => plan.implementedAt === null && plan.turnId === latestTurnId,
        ),
    });
    switch (decision.action) {
      case "none":
        return;
      case "stop":
        yield* stop(item.threadId, decision.reason, decision.detail);
        return;
      case "continue": {
        // The decider refuses the count when the user switched it off after
        // we read the thread; then nothing is sent.
        const counted = yield* engine
          .dispatch({
            type: "thread.meta.update",
            commandId: yield* commandId(item.threadId, "count"),
            threadId: item.threadId,
            autonomous: { enabled: true, count: decision.nextCount, cap: state.cap },
          })
          .pipe(
            Effect.as(true),
            Effect.catchTag("OrchestrationCommandInvariantError", () => Effect.succeed(false)),
          );
        if (!counted) return;
        const messageId = MessageId.make(
          `server:autonomous:${item.threadId}:${yield* crypto.randomUUIDv4}`,
        );
        yield* engine
          .dispatch({
            type: "thread.turn.start",
            commandId: yield* commandId(item.threadId, "continue"),
            threadId: item.threadId,
            message: {
              messageId,
              role: "user",
              text: autoContinueMessageText(decision.nextCount, state.cap),
              attachments: [],
            },
            modelSelection: thread.modelSelection,
            runtimeMode: thread.runtimeMode,
            interactionMode: thread.interactionMode,
            createdAt: yield* nowIso,
          })
          .pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterruptsOnly(cause)
                ? Effect.failCause(cause)
                : stop(item.threadId, "error", "Could not send the auto-continue turn"),
            ),
          );
      }
    }
  });

  /**
   * Answer a native question with the assume-and-log instruction, or the
   * first option when custom answers are not allowed, so the running turn is
   * not stuck waiting for a person. Anything else is left for them.
   */
  const answerUserInput = Effect.fn("ThreadAutonomousReactor.answerUserInput")(function* (
    item: Extract<WorkItem, { kind: "user-input" }>,
  ) {
    const requested = decodeUserInputRequested(item.payload);
    if (Option.isNone(requested) || requested.value.responseMode === "message") return;
    const detail = yield* snapshots.getThreadDetailById(item.threadId);
    if (Option.isNone(detail) || detail.value.autonomous?.enabled !== true) return;

    const answers: Record<string, string | string[]> = {};
    for (const question of requested.value.questions) {
      const first = question.options[0];
      if (question.allowCustomAnswer !== false) {
        answers[question.id] = AUTONOMOUS_ASSUME_ANSWER;
      } else if (first !== undefined) {
        const value = first.value ?? first.label;
        answers[question.id] = question.multiSelect === true ? [value] : value;
      } else {
        return;
      }
    }
    yield* engine.dispatch({
      type: "thread.user-input.respond",
      commandId: yield* commandId(item.threadId, "answer"),
      threadId: item.threadId,
      requestId: ApprovalRequestId.make(item.requestId),
      answers,
      createdAt: yield* nowIso,
    });
  });

  const process = (item: WorkItem) =>
    (item.kind === "interrupt-requested"
      ? stopIfEnabled(item.threadId)
      : item.kind === "user-input"
        ? answerUserInput(item)
        : evaluate(item)
    ).pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) =>
          Effect.logWarning("autonomous mode step failed", {
            threadId: item.threadId,
            kind: item.kind,
            cause: Cause.pretty(cause),
          }),
      ),
    );

  // The user pressing stop always wins, even before the session reports it.
  const stopIfEnabled = Effect.fn("ThreadAutonomousReactor.stopIfEnabled")(function* (
    threadId: ThreadId,
  ) {
    const detail = yield* snapshots.getThreadDetailById(threadId);
    if (Option.isNone(detail) || detail.value.autonomous?.enabled !== true) return;
    yield* stop(threadId, "interrupted", null);
  });

  const worker = yield* makeDrainableWorker(process);

  const processEvent = (event: OrchestrationEvent): Effect.Effect<void> => {
    switch (event.type) {
      case "thread.session-set": {
        const { threadId, session } = event.payload;
        const previous = lastStatus.get(threadId);
        lastStatus.set(threadId, session.status);
        const wasActive = previous === "running" || previous === "starting";
        // A bare ready (provider start-up, resume) is not a turn end, but a
        // failure, stop or interrupt is, whatever came before it.
        const ended =
          session.status === "ready"
            ? wasActive
            : TURN_ENDED_STATUSES.has(session.status) && previous !== session.status;
        return ended ? worker.enqueue({ kind: "turn-ended", threadId }) : Effect.void;
      }
      case "thread.turn-interrupt-requested":
        // Run inline: queued work may be waiting on the ingestion drain, and
        // the user's stop must not wait behind it.
        return process({ kind: "interrupt-requested", threadId: event.payload.threadId }).pipe(
          Effect.ignore,
        );
      case "thread.meta-updated": {
        const autonomous = event.payload.autonomous;
        // Only turning it on writes count 0; later counts and stops never do.
        if (autonomous?.enabled === true && autonomous.count === 0) {
          return worker.enqueue({ kind: "enabled", threadId: event.payload.threadId });
        }
        return Effect.void;
      }
      case "thread.activity-appended": {
        const { threadId, activity } = event.payload;
        const payload = activity.payload;
        if (
          activity.kind === "user-input.requested" &&
          typeof payload === "object" &&
          payload !== null &&
          "requestId" in payload &&
          typeof payload.requestId === "string"
        ) {
          return worker.enqueue({
            kind: "user-input",
            threadId,
            requestId: payload.requestId,
            payload,
          });
        }
        return Effect.void;
      }
      case "thread.deleted":
        lastStatus.delete(event.payload.threadId);
        return Effect.void;
      default:
        return Effect.void;
    }
  };

  const start: ThreadAutonomousReactor["Service"]["start"] = Effect.fn(
    "ThreadAutonomousReactor.start",
  )(function* () {
    // Subscribe before reading so no event falls in the gap.
    const events = yield* engine.subscribeDomainEvents;
    // Reactors start before the orphaned-session reconcile, whose error
    // transition for a turn that died with the server must count as a turn
    // end. Threads that are autonomous and idle get one evaluation now.
    const snapshot = yield* snapshots.getShellSnapshot().pipe(Effect.orDie);
    for (const thread of snapshot.threads) {
      const status = thread.session?.status;
      if (status !== undefined) lastStatus.set(thread.id, status);
      if (
        thread.autonomous?.enabled === true &&
        (status === undefined || status === "idle" || status === "ready")
      ) {
        yield* worker.enqueue({ kind: "enabled", threadId: thread.id });
      }
    }
    yield* forkParked(Stream.runForEach(events, processEvent));
  });

  return { start, drain: worker.drain } satisfies ThreadAutonomousReactor["Service"];
});

export const layer = Layer.effect(ThreadAutonomousReactor, make);
