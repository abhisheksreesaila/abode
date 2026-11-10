import {
  WS_METHODS,
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
} from "@t3tools/contracts";

/** Who may call the Kit's RPCs, and the metric group each reports under. */
export const KIT_RPC_SCOPES = {
  // Reading can open ~/.claude.json, which holds MCP env values, so read and write need operate.
  [WS_METHODS.customizationsList]: AuthOrchestrationReadScope,
  [WS_METHODS.customizationsReadFile]: AuthOrchestrationOperateScope,
  [WS_METHODS.customizationsWriteFile]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillSourcesList]: AuthOrchestrationReadScope,
  [WS_METHODS.skillSourcesCheckNow]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillSourcesDecide]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillUsageList]: AuthOrchestrationReadScope,
  [WS_METHODS.skillPruneCut]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillPruneRestore]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillPruneTrash]: AuthOrchestrationReadScope,
} as const;

export const KIT_RPC_AGGREGATES = {
  [WS_METHODS.customizationsList]: "workspace",
  [WS_METHODS.customizationsReadFile]: "workspace",
  [WS_METHODS.customizationsWriteFile]: "workspace",
  [WS_METHODS.skillSourcesList]: "workspace",
  [WS_METHODS.skillSourcesCheckNow]: "workspace",
  [WS_METHODS.skillSourcesDecide]: "workspace",
  [WS_METHODS.skillUsageList]: "workspace",
  [WS_METHODS.skillPruneCut]: "workspace",
  [WS_METHODS.skillPruneRestore]: "workspace",
  [WS_METHODS.skillPruneTrash]: "workspace",
} as const;
