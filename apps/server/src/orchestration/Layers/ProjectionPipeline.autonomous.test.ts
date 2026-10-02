import { CommandId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ServerConfig } from "../../config.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "../../persistence/Layers/OrchestrationCommandReceipts.ts";
import { OrchestrationEventStoreLive } from "../../persistence/Layers/OrchestrationEventStore.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import * as RepositoryIdentityResolver from "../../project/RepositoryIdentityResolver.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { OrchestrationProjectionPipeline } from "../Services/ProjectionPipeline.ts";
import { ProjectionSnapshotQuery } from "../Services/ProjectionSnapshotQuery.ts";
import * as ThreadBackgroundLiveness from "../ThreadBackgroundLiveness.ts";
import * as ThreadPlanProgress from "../ThreadPlanProgress.ts";
import { OrchestrationEngineLive } from "./OrchestrationEngine.ts";
import { OrchestrationProjectionPipelineLive } from "./ProjectionPipeline.ts";
import { OrchestrationProjectionSnapshotQueryLive } from "./ProjectionSnapshotQuery.ts";

const layer = OrchestrationEngineLive.pipe(
  Layer.provideMerge(OrchestrationProjectionSnapshotQueryLive),
  Layer.provide(ThreadBackgroundLiveness.layer),
  Layer.provide(ThreadPlanProgress.layer),
  Layer.provideMerge(OrchestrationProjectionPipelineLive),
  Layer.provide(OrchestrationEventStoreLive),
  Layer.provide(OrchestrationCommandReceiptRepositoryLive),
  Layer.provide(RepositoryIdentityResolver.layer),
  Layer.provideMerge(SqlitePersistenceMemory),
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-autonomous-" })),
  Layer.provideMerge(NodeServices.layer),
);

it.layer(Layer.fresh(layer))("autonomous state persistence", (it) => {
  it.effect("survives a projection rebuild from the event log (a restart)", () =>
    Effect.gen(function* () {
      const engine = yield* OrchestrationEngineService;
      const pipeline = yield* OrchestrationProjectionPipeline;
      const snapshots = yield* ProjectionSnapshotQuery;
      const createdAt = "2026-01-01T00:00:00.000Z";
      const projectId = ProjectId.make("project-auto");
      const threadId = ThreadId.make("thread-auto");
      const quiet = ThreadId.make("thread-quiet");

      yield* engine.dispatch({
        type: "project.create",
        commandId: CommandId.make("cmd-auto-project"),
        projectId,
        title: "Auto",
        workspaceRoot: "/tmp/project-auto",
        defaultModelSelection: {
          instanceId: ProviderInstanceId.make("codex"),
          model: "gpt-5-codex",
        },
        createdAt,
      });
      for (const id of [threadId, quiet]) {
        yield* engine.dispatch({
          type: "thread.create",
          commandId: CommandId.make(`cmd-create-${id}`),
          threadId: id,
          projectId,
          title: id,
          modelSelection: {
            instanceId: ProviderInstanceId.make("codex"),
            model: "gpt-5-codex",
          },
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt,
        });
      }
      yield* engine.dispatch({
        type: "thread.meta.update",
        commandId: CommandId.make("cmd-auto-on"),
        threadId,
        autonomous: { enabled: true },
      });
      yield* engine.dispatch({
        type: "thread.meta.update",
        commandId: CommandId.make("cmd-auto-count"),
        threadId,
        autonomous: { enabled: true, count: 3 },
      });

      const read = (id: ThreadId) =>
        snapshots
          .getThreadDetailById(id)
          .pipe(Effect.map((thread) => Option.getOrThrow(thread).autonomous));
      const expected = { enabled: true, count: 3, cap: 30, stopReason: null, stopDetail: null };
      assert.deepStrictEqual(yield* read(threadId), expected);

      yield* pipeline.bootstrap;
      assert.deepStrictEqual(yield* read(threadId), expected);

      // Threads that never enabled it carry no state, as on servers without the field.
      assert.isTrue((yield* read(quiet)) == null);
      const shell = yield* snapshots.getThreadShellById(threadId);
      assert.deepStrictEqual(Option.getOrThrow(shell).autonomous, expected);
    }),
  );
});
