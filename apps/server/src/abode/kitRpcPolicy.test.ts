import { describe, expect, it } from "@effect/vitest";
import {
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
  WS_METHODS,
} from "@t3tools/contracts";

import { KIT_RPC_SCOPES } from "./kitRpcPolicy.ts";

describe("KIT_RPC_SCOPES", () => {
  it("needs operate to read or change files and to install or prune skills", () => {
    for (const method of [
      WS_METHODS.customizationsReadFile,
      WS_METHODS.customizationsWriteFile,
      WS_METHODS.skillSourcesCheckNow,
      WS_METHODS.skillSourcesDecide,
      WS_METHODS.skillPruneCut,
      WS_METHODS.skillPruneRestore,
    ]) {
      expect(KIT_RPC_SCOPES[method]).toBe(AuthOrchestrationOperateScope);
    }
    expect(KIT_RPC_SCOPES[WS_METHODS.customizationsList]).toBe(AuthOrchestrationReadScope);
  });
});
