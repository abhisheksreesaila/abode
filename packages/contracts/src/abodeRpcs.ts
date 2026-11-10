import {
  WsCustomizationsListRpc,
  WsCustomizationsReadFileRpc,
  WsCustomizationsWriteFileRpc,
} from "./abodeCustomizations.ts";
import {
  WsSkillSourcesCheckNowRpc,
  WsSkillSourcesDecideRpc,
  WsSkillSourcesListRpc,
  WsSkillUsageListRpc,
  WsSkillPruneCutRpc,
  WsSkillPruneRestoreRpc,
  WsSkillPruneTrashRpc,
} from "./abodeSkillSources.ts";

/** abode's add-only RPCs: `rpc.ts` spreads these once, so new ones never touch upstream. */
export const ABODE_WS_METHODS = {
  customizationsList: "customizations.list",
  customizationsReadFile: "customizations.readFile",
  customizationsWriteFile: "customizations.writeFile",
  skillSourcesList: "skillSources.list",
  skillSourcesCheckNow: "skillSources.checkNow",
  skillSourcesDecide: "skillSources.decide",
  skillUsageList: "skillUsage.list",
  skillPruneCut: "skillPrune.cut",
  skillPruneRestore: "skillPrune.restore",
  skillPruneTrash: "skillPrune.trash",
} as const;

export const ABODE_RPCS = [
  WsCustomizationsListRpc,
  WsCustomizationsReadFileRpc,
  WsCustomizationsWriteFileRpc,
  WsSkillSourcesListRpc,
  WsSkillSourcesCheckNowRpc,
  WsSkillSourcesDecideRpc,
  WsSkillUsageListRpc,
  WsSkillPruneCutRpc,
  WsSkillPruneRestoreRpc,
  WsSkillPruneTrashRpc,
] as const;
