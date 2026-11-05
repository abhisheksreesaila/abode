import {
  WS_METHODS,
  AuthOrchestrationOperateScope,
  AuthOrchestrationReadScope,
} from "@t3tools/contracts";

/** Who may call the skill-source RPCs, and the metric group each reports under. */
export const SKILL_SOURCES_RPC_SCOPES = {
  [WS_METHODS.skillSourcesList]: AuthOrchestrationReadScope,
  [WS_METHODS.skillSourcesCheckNow]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillSourcesDecide]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillUsageList]: AuthOrchestrationReadScope,
  [WS_METHODS.skillPruneCut]: AuthOrchestrationOperateScope,
  [WS_METHODS.skillPruneRestore]: AuthOrchestrationOperateScope,
} as const;

export const SKILL_SOURCES_RPC_AGGREGATES = {
  [WS_METHODS.skillSourcesList]: "workspace",
  [WS_METHODS.skillSourcesCheckNow]: "workspace",
  [WS_METHODS.skillSourcesDecide]: "workspace",
  [WS_METHODS.skillUsageList]: "workspace",
  [WS_METHODS.skillPruneCut]: "workspace",
  [WS_METHODS.skillPruneRestore]: "workspace",
} as const;
