import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { OrchestrationV2Subagent } from "./orchestrationV2.ts";

const decode = Schema.decodeUnknownSync(OrchestrationV2Subagent);

// A-018: agentType is optional and add-only, so old payloads still decode.
describe("OrchestrationV2Subagent.agentType", () => {
  const now = DateTime.makeUnsafe("2026-10-14T00:00:00.000Z");
  const base = {
    id: "node-subagent-1",
    threadId: "thread-1",
    runId: "run-1",
    parentNodeId: "node-root-1",
    origin: "provider_native",
    createdBy: "agent",
    driver: "claudeAgent",
    providerInstanceId: "claudeAgent",
    providerThreadId: null,
    childThreadId: null,
    nativeTaskRef: null,
    prompt: "Review",
    title: null,
    model: null,
    status: "running",
    result: null,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };

  it("decodes an old payload without the field", () => {
    expect("agentType" in decode(base)).toBe(false);
  });

  it("keeps the field when present", () => {
    expect(decode({ ...base, agentType: "reviewer" }).agentType).toBe("reviewer");
  });
});
