import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import {
  ClaudeSettings,
  MessageId,
  type ModelSelection,
  NodeId,
  ProjectId,
  ProviderInstanceId,
  ProviderSessionId,
  RunAttemptId,
  RunId,
  ThreadId,
} from "@t3tools/contracts";
import * as IdAllocator from "@t3tools/provider-core/server/IdAllocator";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import * as ClaudeAdapterV2 from "../orchestration-v2/Adapters/ClaudeAdapterV2.ts";

// A-018: the subagent's type from Claude frames reaches the projected subagent.
const SESSION = "native-thread-abode-agent-type";
let uuidCounter = 0;
const nextUuid = () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`;
const claudeSettings = Schema.decodeSync(ClaudeSettings)({});
const frame = (value: unknown) => value as SDKMessage;
const modelSelection = {
  instanceId: ProviderInstanceId.make(ClaudeAdapterV2.CLAUDE_PROVIDER),
  model: "claude-sonnet-4-6",
} satisfies ModelSelection;
const runtimePolicy = ProviderAdapter.ProviderAdapterV2RuntimePolicy.make({
  runtimeMode: "full-access",
  interactionMode: "default",
  cwd: "/workspace",
});

const started = (subagentType?: string) =>
  frame({
    type: "system",
    subtype: "task_started",
    task_id: "task-1",
    tool_use_id: "toolu-1",
    description: "Review",
    task_type: "local_agent",
    ...(subagentType === undefined ? {} : { subagent_type: subagentType }),
    uuid: nextUuid(),
    session_id: SESSION,
  });
const progress = (subagentType?: string) =>
  frame({
    type: "system",
    subtype: "task_progress",
    task_id: "task-1",
    tool_use_id: "toolu-1",
    description: "Reading the diff",
    usage: { total_tokens: 1, tool_uses: 0, duration_ms: 1 },
    ...(subagentType === undefined ? {} : { subagent_type: subagentType }),
    uuid: nextUuid(),
    session_id: SESSION,
  });
const result = frame({
  type: "result",
  subtype: "success",
  duration_ms: 10,
  duration_api_ms: 10,
  is_error: false,
  num_turns: 1,
  result: "done",
  stop_reason: "end_turn",
  total_cost_usd: 0,
  usage: {
    input_tokens: 1,
    output_tokens: 1,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  modelUsage: {},
  permission_denials: [],
  uuid: nextUuid(),
  session_id: SESSION,
});

const agentTypesFor = (frames: ReadonlyArray<SDKMessage>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const sdkMessages = yield* Queue.unbounded<SDKMessage>();
      const adapter = yield* ClaudeAdapterV2.makeClaudeAdapterV2({
        instanceId: ClaudeAdapterV2.CLAUDE_DEFAULT_INSTANCE_ID,
        settings: claudeSettings,
        environment: {},
        attachmentsDir: yield* fileSystem.makeTempDirectoryScoped({ prefix: "abode-agent-type-" }),
        fileSystem,
        path: yield* Path.Path,
        crypto: yield* Crypto.Crypto,
        idAllocator: yield* IdAllocator.IdAllocatorV2,
        continuationRequests: { offer: () => Effect.void },
        queryRunner: {
          allocateSessionId: Effect.succeed(SESSION),
          open: () =>
            Effect.succeed({
              messages: Stream.fromQueue(sdkMessages),
              offer: () => Effect.void,
              setModel: () => Effect.void,
              applyFlagSettings: () => Effect.void,
              setPermissionMode: () => Effect.void,
              stopTask: () => Effect.void,
              interrupt: Effect.void,
              close: Effect.void,
            }),
          forkSession: () => Effect.die("unused forkSession"),
          subagentLaunchToolUseId: () => Effect.succeed(null),
          assertComplete: Effect.void,
        },
      });
      const threadId = ThreadId.make("thread-abode-agent-type");
      const runtime = yield* adapter.openSession({
        threadId,
        providerSessionId: ProviderSessionId.make("provider-session-abode-agent-type"),
        modelSelection,
        runtimePolicy,
      });
      const providerThread = yield* runtime.ensureThread({
        threadId,
        modelSelection,
        runtimePolicy,
      });
      const events: Array<ProviderAdapter.ProviderAdapterV2Event> = [];
      const terminal = yield* Queue.unbounded<unknown>();
      yield* runtime.events.pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            events.push(event);
            if (event.type === "turn.terminal") yield* Queue.offer(terminal, event);
          }),
        ),
        Effect.forkScoped,
      );
      const now = yield* DateTime.now;
      const attemptId = RunAttemptId.make("attempt-abode-agent-type");
      yield* runtime.startTurn({
        appThread: {
          createdBy: "user",
          creationSource: "web",
          id: threadId,
          projectId: ProjectId.make("project-abode-agent-type"),
          title: "agent type",
          providerInstanceId: modelSelection.instanceId,
          modelSelection,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          activeProviderThreadId: providerThread.id,
          lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: threadId },
          forkedFrom: null,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
          settledOverride: null,
          settledAt: null,
          lastVisitedAt: null,
          deletedAt: null,
        },
        threadId,
        runId: RunId.make(`run-${attemptId}`),
        runOrdinal: 1,
        providerTurnOrdinal: 1,
        attemptId,
        rootNodeId: NodeId.make(`node-${attemptId}`),
        providerThread,
        message: {
          createdBy: "user",
          creationSource: "web",
          messageId: MessageId.make(`message-${attemptId}`),
          text: "Spawn a subagent.",
          attachments: [],
        },
        modelSelection,
        runtimePolicy,
      });
      for (const next of [...frames, result]) yield* Queue.offer(sdkMessages, next);
      yield* Queue.take(terminal);
      return events.flatMap((event) =>
        event.type === "subagent.updated" ? [event.subagent.agentType] : [],
      );
    }),
  ).pipe(
    Effect.provide(
      Layer.mergeAll(IdAllocator.layer, McpProviderSessions.layer, NodeServices.layer),
    ),
  );

describe("subagent agentType through the Claude adapter", () => {
  it.effect("task_started with subagent_type sets it", () =>
    Effect.gen(function* () {
      const types = yield* agentTypesFor([started("reviewer")]);
      assert.isAbove(types.length, 0);
      assert.deepEqual(new Set(types), new Set(["reviewer"]));
    }),
  );

  it.effect("task_started without subagent_type leaves it absent", () =>
    Effect.gen(function* () {
      const types = yield* agentTypesFor([started()]);
      assert.isAbove(types.length, 0);
      assert.deepEqual(new Set(types), new Set([undefined]));
    }),
  );

  it.effect("a task_progress that created the subagent first still gets the type", () =>
    Effect.gen(function* () {
      const types = yield* agentTypesFor([progress(), started("reviewer")]);
      assert.equal(types.at(-1), "reviewer");
    }),
  );

  it.effect("task_progress carrying the type sets it, and a later frame keeps it", () =>
    Effect.gen(function* () {
      const types = yield* agentTypesFor([progress("reviewer"), started("developer")]);
      assert.equal(types[0], "reviewer");
      assert.equal(types.at(-1), "reviewer");
    }),
  );
});
