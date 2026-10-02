import {
  CommandId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationReadModel,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";
import { projectEvent } from "./projector.ts";

const UPDATED_AT = "2026-01-01T00:00:00.000Z";
const THREAD_ID = ThreadId.make("thread-1");

const baseThread = {
  id: THREAD_ID,
  projectId: ProjectId.make("project-1"),
  title: "Thread",
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
  runtimeMode: "full-access" as const,
  interactionMode: "default" as const,
  branch: null,
  worktreePath: null,
  pullRequests: [],
  latestTurn: null,
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  archivedAt: null,
  settledOverride: null,
  settledAt: null,
  snoozedUntil: null,
  snoozedAt: null,
  deletedAt: null,
  messages: [],
  proposedPlans: [],
  activities: [],
  checkpoints: [],
  session: null,
};

const readModel: OrchestrationReadModel = {
  snapshotSequence: 0,
  projects: [],
  threads: [baseThread],
  updatedAt: UPDATED_AT,
};

const decide = (
  autonomous: { enabled: boolean; count?: number; stopReason?: "done" },
  model: OrchestrationReadModel = readModel,
) =>
  decideOrchestrationCommand({
    command: {
      type: "thread.meta.update",
      commandId: CommandId.make("cmd-autonomous"),
      threadId: THREAD_ID,
      autonomous,
    },
    readModel: model,
  }).pipe(Effect.map((result) => (Array.isArray(result) ? result[0]! : result)));

it.layer(NodeServices.layer)("autonomous meta update", (it) => {
  it.effect("enabling starts at zero with the default cap and keeps recency", () =>
    Effect.gen(function* () {
      const event = yield* decide({ enabled: true });
      expect(event.type).toBe("thread.meta-updated");
      if (event.type === "thread.meta-updated") {
        expect(event.payload.autonomous).toEqual({
          enabled: true,
          count: 0,
          cap: 30,
          stopReason: null,
          stopDetail: null,
        });
        expect(event.payload.updatedAt).toBe(UPDATED_AT);
      }
    }),
  );

  it.effect("stopping keeps the count and records the reason", () =>
    Effect.gen(function* () {
      const running = {
        ...readModel,
        threads: [{ ...baseThread, autonomous: { enabled: true, count: 7, cap: 12 } }],
      };
      const event = yield* decide({ enabled: false, stopReason: "done" }, running);
      if (event.type !== "thread.meta-updated") throw new Error("unexpected event");
      expect(event.payload.autonomous).toEqual({
        enabled: false,
        count: 7,
        cap: 12,
        stopReason: "done",
        stopDetail: null,
      });
    }),
  );

  it.effect("the projected thread carries the state, and unrelated threads stay unmarked", () =>
    Effect.gen(function* () {
      const event = yield* decide({ enabled: true });
      const projected = yield* projectEvent(readModel, {
        ...event,
        sequence: 1,
      });
      expect(projected.threads[0]?.autonomous?.enabled).toBe(true);
      expect(readModel.threads[0]?.autonomous).toBeUndefined();
    }),
  );

  it.effect("refuses a count update after the thread was switched off", () =>
    Effect.gen(function* () {
      const stopped = {
        ...readModel,
        threads: [{ ...baseThread, autonomous: { enabled: false, count: 4, cap: 30 } }],
      };
      const result = yield* Effect.result(decide({ enabled: true, count: 5 }, stopped));
      expect(result._tag).toBe("Failure");
      // Turning it back on (no count) is still allowed.
      const reenabled = yield* decide({ enabled: true }, stopped);
      expect(reenabled.type).toBe("thread.meta-updated");
    }),
  );
});
