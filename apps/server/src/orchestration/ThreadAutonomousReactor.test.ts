import {
  CommandId,
  EventId,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationCommand,
  type OrchestrationEvent,
  type OrchestrationMessage,
  type OrchestrationShellSnapshot,
  type OrchestrationSessionStatus,
  type OrchestrationThread,
  type ThreadAutonomousState,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { ServerActivation } from "../serverActivation.ts";
import { OrchestrationCommandInvariantError } from "./Errors.ts";
import {
  OrchestrationEngineService,
  type OrchestrationEngineShape,
} from "./Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "./Services/ProjectionSnapshotQuery.ts";
import { ProviderRuntimeIngestionService } from "./Services/ProviderRuntimeIngestion.ts";
import * as ThreadAutonomousReactor from "./ThreadAutonomousReactor.ts";

const NOW = "2026-08-28T12:00:00.000Z";
const testCrypto = Crypto.make({
  randomBytes: (size) => new Uint8Array(size).fill(1),
  digest: (_algorithm, data) => Effect.succeed(data),
});

const message = (
  role: "user" | "assistant",
  text: string,
  id = `${role}-${text.length}`,
): OrchestrationMessage => ({
  id: MessageId.make(id),
  role,
  text,
  turnId: null,
  streaming: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const makeThread = (
  id: string,
  overrides: Partial<OrchestrationThread> = {},
): OrchestrationThread => ({
  id: ThreadId.make(id),
  projectId: ProjectId.make("project"),
  title: id,
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  pullRequests: [],
  latestTurn: null,
  createdAt: NOW,
  updatedAt: NOW,
  archivedAt: null,
  settledOverride: null,
  settledAt: null,
  deletedAt: null,
  messages: [message("user", "do the thing"), message("assistant", "Worked on it.")],
  proposedPlans: [],
  activities: [],
  checkpoints: [],
  session: {
    threadId: ThreadId.make(id),
    status: "ready",
    providerName: "Codex",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: null,
    updatedAt: NOW,
  },
  ...overrides,
});

const on = (overrides: Partial<ThreadAutonomousState> = {}): ThreadAutonomousState => ({
  enabled: true,
  count: 0,
  cap: 30,
  ...overrides,
});

let sequence = 0;
const eventBase = (threadId: ThreadId) => {
  sequence += 1;
  return {
    sequence,
    eventId: EventId.make(`evt-${sequence}`),
    aggregateKind: "thread" as const,
    aggregateId: threadId,
    occurredAt: NOW,
    commandId: CommandId.make(`cmd-${sequence}`),
    causationEventId: null,
    correlationId: null,
    metadata: {},
  };
};

const sessionSet = (threadId: ThreadId, status: OrchestrationSessionStatus): OrchestrationEvent =>
  ({
    ...eventBase(threadId),
    type: "thread.session-set",
    payload: {
      threadId,
      session: {
        threadId,
        status,
        providerName: "Codex",
        runtimeMode: "full-access",
        activeTurnId: status === "running" ? TurnId.make("turn-1") : null,
        lastError: null,
        updatedAt: NOW,
      },
    },
  }) as OrchestrationEvent;

interface HarnessOptions {
  /** What the startup read of the read model sees; empty unless a test is about restarts. */
  readonly shells?: ReadonlyArray<OrchestrationThread>;
  /** Ingestion's drain waits on this, like a turn that is still being finalized. */
  readonly drainGate?: Deferred.Deferred<void>;
  /** The decider refuses count updates, as when the user switched it off meanwhile. */
  readonly rejectCount?: boolean;
}

const makeHarness = Effect.fn("makeAutonomousHarness")(function* (
  threads: ReadonlyArray<OrchestrationThread>,
  options: HarnessOptions = {},
) {
  const activation = yield* Deferred.make<void>();
  const store = yield* Ref.make(new Map(threads.map((thread) => [thread.id, thread])));
  const domainEvents = yield* PubSub.unbounded<OrchestrationEvent>();
  const commands = yield* Ref.make<ReadonlyArray<OrchestrationCommand>>([]);
  const dispatched = yield* Queue.unbounded<OrchestrationCommand>();
  const drainCount = yield* Ref.make(0);

  const dispatch: OrchestrationEngineShape["dispatch"] = (command) =>
    Effect.gen(function* () {
      yield* Ref.update(commands, (all) => [...all, command]);
      if (
        options.rejectCount === true &&
        command.type === "thread.meta.update" &&
        (command.autonomous?.count ?? 0) > 0
      ) {
        yield* Queue.offer(dispatched, command);
        return yield* new OrchestrationCommandInvariantError({
          commandType: command.type,
          detail: "autonomous mode is off",
        });
      }
      // Mirror what the real decider does to the stored thread so later
      // evaluations see the new count and stop state.
      if (command.type === "thread.meta.update" && command.autonomous !== undefined) {
        const patch = command.autonomous;
        yield* Ref.update(store, (map) => {
          const current = map.get(command.threadId);
          if (current === undefined) return map;
          const next = new Map(map);
          next.set(command.threadId, {
            ...current,
            autonomous: {
              enabled: patch.enabled,
              count: patch.count ?? current.autonomous?.count ?? 0,
              cap: patch.cap ?? current.autonomous?.cap ?? 30,
              stopReason: patch.stopReason ?? null,
              stopDetail: patch.stopDetail ?? null,
            },
          });
          return next;
        });
      }
      yield* Queue.offer(dispatched, command);
      return { sequence: 1 };
    });

  const layer = ThreadAutonomousReactor.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(ProjectionSnapshotQuery)({
          getShellSnapshot: () =>
            Effect.succeed({
              snapshotSequence: 0,
              projects: [],
              threads: (options.shells ?? []).map((thread) => ({
                id: thread.id,
                session: thread.session,
                autonomous: thread.autonomous,
              })),
              updatedAt: NOW,
            } as unknown as OrchestrationShellSnapshot),
          getThreadDetailById: (threadId) =>
            Ref.get(store).pipe(Effect.map((map) => Option.fromUndefinedOr(map.get(threadId)))),
        }),
        Layer.mock(OrchestrationEngineService)({
          readEvents: () => Stream.empty,
          dispatch,
          streamDomainEvents: Stream.empty,
          subscribeDomainEvents: PubSub.subscribe(domainEvents).pipe(
            Effect.map((subscription) => Stream.fromSubscription(subscription)),
          ),
          latestSequence: Effect.succeed(0),
        }),
        Layer.succeed(ProviderRuntimeIngestionService, {
          start: () => Effect.void,
          drain: Ref.update(drainCount, (count) => count + 1).pipe(
            Effect.andThen(options.drainGate ? Deferred.await(options.drainGate) : Effect.void),
          ),
        }),
        Layer.succeed(ServerActivation, Deferred.await(activation)),
        Layer.succeed(Crypto.Crypto, testCrypto),
      ),
    ),
  );

  return {
    activation,
    store,
    commands,
    dispatched,
    drainCount,
    publish: (event: OrchestrationEvent) => PubSub.publish(domainEvents, event),
    layer,
  };
});

const run = <A, E>(
  threads: ReadonlyArray<OrchestrationThread>,
  body: (
    harness: Effect.Success<ReturnType<typeof makeHarness>> & {
      readonly reactor: ThreadAutonomousReactor.ThreadAutonomousReactor["Service"];
    },
  ) => Effect.Effect<A, E>,
  options: HarnessOptions = {},
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const harness = yield* makeHarness(threads, options);
      const context = yield* Layer.build(harness.layer);
      const reactor = Context.get(context, ThreadAutonomousReactor.ThreadAutonomousReactor);
      yield* reactor.start();
      yield* Deferred.succeed(harness.activation, undefined);
      return yield* body({ ...harness, reactor });
    }),
  );

const take = (queue: Queue.Queue<OrchestrationCommand>, count: number) =>
  Effect.forEach(Array.from({ length: count }), () => Queue.take(queue));

const A = ThreadId.make("auto");
const SENTINEL = ThreadId.make("sentinel");

/** A positive control: once its nudge is out, everything published before it was processed. */
const endTurn = (threadId: ThreadId) => [
  sessionSet(threadId, "running"),
  sessionSet(threadId, "ready"),
];

describe("ThreadAutonomousReactor", () => {
  it.effect("nudges with the auto-continue turn when a turn ends without the done marker", () =>
    run([makeThread("auto", { autonomous: on({ count: 2 }) })], (harness) =>
      Effect.gen(function* () {
        for (const event of endTurn(A)) yield* harness.publish(event);
        const [count, turn] = yield* take(harness.dispatched, 2);
        assert.strictEqual(count?.type, "thread.meta.update");
        assert.deepStrictEqual(count?.type === "thread.meta.update" && count.autonomous, {
          enabled: true,
          count: 3,
          cap: 30,
        });
        assert.strictEqual(turn?.type, "thread.turn.start");
        if (turn?.type === "thread.turn.start") {
          assert.match(turn.message.text, /^\[abode:auto 3\/30\]\nContinue working autonomously/);
          assert.match(turn.message.text, /ABODE:DONE/);
          assert.strictEqual(turn.runtimeMode, "full-access");
        }
        // The turn waited for ingestion to finish finalizing the last message.
        assert.strictEqual(yield* Ref.get(harness.drainCount), 1);
      }),
    ),
  );

  it.effect("stops and clears the running state when the final text ends with ABODE:DONE", () =>
    run(
      [
        makeThread("auto", {
          autonomous: on({ count: 4 }),
          messages: [message("user", "go"), message("assistant", "All shipped.\nABODE:DONE")],
        }),
      ],
      (harness) =>
        Effect.gen(function* () {
          for (const event of endTurn(A)) yield* harness.publish(event);
          const [stop] = yield* take(harness.dispatched, 1);
          assert.deepStrictEqual(stop?.type === "thread.meta.update" && stop.autonomous, {
            enabled: false,
            stopReason: "done",
            stopDetail: null,
          });
          assert.strictEqual((yield* Ref.get(harness.commands)).length, 1);
        }),
    ),
  );

  it.effect("stops and records why when the turn failed", () =>
    run(
      [
        makeThread("auto", {
          autonomous: on(),
          session: {
            threadId: A,
            status: "error",
            providerName: "Claude",
            runtimeMode: "full-access",
            activeTurnId: null,
            lastError: "429 usage limit reached",
            updatedAt: NOW,
          },
        }),
      ],
      (harness) =>
        Effect.gen(function* () {
          yield* harness.publish(sessionSet(A, "running"));
          yield* harness.publish(sessionSet(A, "error"));
          const [stop] = yield* take(harness.dispatched, 1);
          assert.deepStrictEqual(stop?.type === "thread.meta.update" && stop.autonomous, {
            enabled: false,
            stopReason: "rate-limited",
            stopDetail: "429 usage limit reached",
          });
        }),
    ),
  );

  it.effect("an interrupt switches autonomous off and nothing is sent afterwards", () =>
    run([makeThread("auto", { autonomous: on({ count: 5 }) })], (harness) =>
      Effect.gen(function* () {
        yield* harness.publish(sessionSet(A, "running"));
        yield* harness.publish({
          ...eventBase(A),
          type: "thread.turn-interrupt-requested",
          payload: { threadId: A, createdAt: NOW },
        } as OrchestrationEvent);
        const [stop] = yield* take(harness.dispatched, 1);
        assert.deepStrictEqual(stop?.type === "thread.meta.update" && stop.autonomous, {
          enabled: false,
          stopReason: "interrupted",
          stopDetail: null,
        });
        // The session then reports the abort; the thread is already off.
        yield* harness.publish(sessionSet(A, "interrupted"));
        yield* harness.publish(sessionSet(SENTINEL, "running"));
        yield* harness.publish(sessionSet(SENTINEL, "ready"));
        yield* Ref.update(harness.store, (map) =>
          new Map(map).set(SENTINEL, makeThread("sentinel", { autonomous: on() })),
        );
        yield* harness.publish(sessionSet(SENTINEL, "running"));
        yield* harness.publish(sessionSet(SENTINEL, "ready"));
        yield* take(harness.dispatched, 2);
        const forAuto = (yield* Ref.get(harness.commands)).filter(
          (command) => "threadId" in command && command.threadId === A,
        );
        assert.strictEqual(forAuto.length, 1);
      }),
    ),
  );

  it.effect("stops at the cap instead of nudging again", () =>
    run([makeThread("auto", { autonomous: on({ count: 30, cap: 30 }) })], (harness) =>
      Effect.gen(function* () {
        for (const event of endTurn(A)) yield* harness.publish(event);
        const [stop] = yield* take(harness.dispatched, 1);
        assert.strictEqual(
          stop?.type === "thread.meta.update" && stop.autonomous?.stopReason,
          "cap",
        );
        assert.strictEqual(
          (yield* Ref.get(harness.commands)).some(
            (command) => command.type === "thread.turn.start",
          ),
          false,
        );
      }),
    ),
  );

  it.effect("leaves threads without the field alone, and ignores a ready with no turn", () =>
    run([makeThread("plain"), makeThread("auto", { autonomous: on() })], (harness) =>
      Effect.gen(function* () {
        const plain = ThreadId.make("plain");
        for (const event of endTurn(plain)) yield* harness.publish(event);
        // A ready that was never preceded by a running turn is not a turn end.
        yield* harness.publish(sessionSet(A, "ready"));
        for (const event of endTurn(A)) yield* harness.publish(event);
        yield* take(harness.dispatched, 2);
        const commands = yield* Ref.get(harness.commands);
        assert.strictEqual(
          commands.filter((command) => "threadId" in command && command.threadId === plain).length,
          0,
        );
        assert.strictEqual(
          commands.filter((command) => command.type === "thread.turn.start").length,
          1,
        );
      }),
    ),
  );

  it.effect("turning it on for an idle thread with history continues right away", () =>
    run([makeThread("auto", { autonomous: on() })], (harness) =>
      Effect.gen(function* () {
        yield* harness.publish({
          ...eventBase(A),
          type: "thread.meta-updated",
          payload: { threadId: A, autonomous: on(), updatedAt: NOW },
        } as OrchestrationEvent);
        const [, turn] = yield* take(harness.dispatched, 2);
        assert.strictEqual(turn?.type, "thread.turn.start");
        assert.strictEqual(yield* Ref.get(harness.drainCount), 0);
      }),
    ),
  );

  it.effect(
    "answers a native question with its first option, and free text with the assume instruction",
    () =>
      run([makeThread("auto", { autonomous: on() })], (harness) =>
        Effect.gen(function* () {
          yield* harness.publish({
            ...eventBase(A),
            type: "thread.activity-appended",
            payload: {
              threadId: A,
              activity: {
                id: EventId.make("activity-1"),
                tone: "info",
                kind: "user-input.requested",
                summary: "User input requested",
                turnId: TurnId.make("turn-1"),
                createdAt: NOW,
                payload: {
                  requestId: "req-1",
                  questions: [
                    {
                      id: "q1",
                      header: "Pick",
                      question: "Which one?",
                      options: [
                        { label: "Alpha", description: "" },
                        { label: "Beta", description: "" },
                      ],
                    },
                    {
                      id: "q3",
                      header: "Strict",
                      question: "Which strict one?",
                      allowCustomAnswer: false,
                      options: [{ label: "Gamma", description: "" }],
                    },
                    { id: "q2", header: "Free", question: "Anything else?", options: [] },
                  ],
                },
              },
            },
          } as OrchestrationEvent);
          const [answer] = yield* take(harness.dispatched, 1);
          assert.strictEqual(answer?.type, "thread.user-input.respond");
          if (answer?.type === "thread.user-input.respond") {
            assert.strictEqual(answer.requestId, "req-1");
            assert.match(String(answer.answers.q1), /most reasonable option/);
            assert.strictEqual(answer.answers.q3, "Gamma");
            assert.match(String(answer.answers.q2), /docs\/plan\.md/);
          }
        }),
      ),
  );

  it.effect("after a restart, a turn that died with the server counts as a turn end", () =>
    run(
      [
        makeThread("auto", {
          autonomous: on({ count: 1 }),
          session: {
            threadId: A,
            status: "error",
            providerName: "Codex",
            runtimeMode: "full-access",
            activeTurnId: null,
            lastError: "Session lost",
            updatedAt: NOW,
          },
        }),
      ],
      (harness) =>
        Effect.gen(function* () {
          // The orphan reconcile marks the interrupted run as failed.
          yield* harness.publish(sessionSet(A, "error"));
          const [stop] = yield* take(harness.dispatched, 1);
          assert.strictEqual(
            stop?.type === "thread.meta.update" && stop.autonomous?.stopReason,
            "error",
          );
        }),
      {
        shells: [
          makeThread("auto", {
            autonomous: on({ count: 1 }),
            session: {
              threadId: A,
              status: "running",
              providerName: "Codex",
              runtimeMode: "full-access",
              activeTurnId: TurnId.make("turn-1"),
              lastError: null,
              updatedAt: NOW,
            },
          }),
        ],
      },
    ),
  );

  it.effect("after a restart, an idle autonomous thread continues right away", () =>
    run(
      [makeThread("auto", { autonomous: on({ count: 1 }) })],
      (harness) =>
        Effect.gen(function* () {
          const [, turn] = yield* take(harness.dispatched, 2);
          assert.strictEqual(turn?.type, "thread.turn.start");
        }),
      { shells: [makeThread("auto", { autonomous: on({ count: 1 }) })] },
    ),
  );

  it.effect("re-enabling after an interrupt or a rate limit continues instead of stopping", () =>
    Effect.gen(function* () {
      for (const [status, lastError] of [
        ["interrupted", null],
        ["error", "429 usage limit reached"],
      ] as const) {
        yield* run(
          [
            makeThread("auto", {
              autonomous: on(),
              session: {
                threadId: A,
                status,
                providerName: "Codex",
                runtimeMode: "full-access",
                activeTurnId: null,
                lastError,
                updatedAt: NOW,
              },
            }),
          ],
          (harness) =>
            Effect.gen(function* () {
              yield* harness.publish({
                ...eventBase(A),
                type: "thread.meta-updated",
                payload: { threadId: A, autonomous: on(), updatedAt: NOW },
              } as OrchestrationEvent);
              const [, turn] = yield* take(harness.dispatched, 2);
              assert.strictEqual(turn?.type, "thread.turn.start");
            }),
        );
      }
    }),
  );

  it.effect("sends nothing when the count update is refused because it was switched off", () =>
    run(
      [makeThread("auto", { autonomous: on() })],
      (harness) =>
        Effect.gen(function* () {
          for (const event of endTurn(A)) yield* harness.publish(event);
          yield* take(harness.dispatched, 1);
          yield* harness.reactor.drain;
          assert.strictEqual(
            (yield* Ref.get(harness.commands)).some(
              (command) => command.type === "thread.turn.start",
            ),
            false,
          );
        }),
      { rejectCount: true },
    ),
  );

  it.effect("stops instead of nudging while a plan waits for approval", () =>
    run(
      [
        makeThread("auto", {
          autonomous: on(),
          interactionMode: "plan",
          latestTurn: {
            turnId: TurnId.make("turn-1"),
            state: "completed",
            requestedAt: NOW,
            startedAt: NOW,
            completedAt: NOW,
            assistantMessageId: null,
          },
          proposedPlans: [
            {
              id: "plan-1" as never,
              turnId: TurnId.make("turn-1"),
              planMarkdown: "# Plan",
              implementedAt: null,
              implementationThreadId: null,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        }),
      ],
      (harness) =>
        Effect.gen(function* () {
          for (const event of endTurn(A)) yield* harness.publish(event);
          const [stop] = yield* take(harness.dispatched, 1);
          assert.strictEqual(
            stop?.type === "thread.meta.update" && stop.autonomous?.stopReason,
            "plan-awaiting-approval",
          );
        }),
    ),
  );

  it.effect("an interrupt is handled even while a turn end waits on ingestion", () =>
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>();
      yield* run(
        [makeThread("auto", { autonomous: on() })],
        (harness) =>
          Effect.gen(function* () {
            for (const event of endTurn(A)) yield* harness.publish(event);
            yield* harness.publish({
              ...eventBase(A),
              type: "thread.turn-interrupt-requested",
              payload: { threadId: A, createdAt: NOW },
            } as OrchestrationEvent);
            const [stop] = yield* take(harness.dispatched, 1);
            assert.strictEqual(
              stop?.type === "thread.meta.update" && stop.autonomous?.stopReason,
              "interrupted",
            );
            yield* Deferred.succeed(gate, undefined);
          }),
        { drainGate: gate },
      );
    }),
  );
});
