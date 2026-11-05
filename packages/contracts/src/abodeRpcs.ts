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
} from "./abodeSkillSources.ts";
import { WsTailnetStatusRpc } from "./abodeTailnet.ts";
import { WsVoiceRpc } from "./abodeVoice.ts";

/** abode's add-only RPCs: `rpc.ts` spreads these once, so new ones never touch upstream. */
export const ABODE_WS_METHODS = {
  customizationsList: "customizations.list",
  customizationsReadFile: "customizations.readFile",
  customizationsWriteFile: "customizations.writeFile",
  voice: "voice.session",
  tailnetStatus: "tailnet.status",
  skillSourcesList: "skillSources.list",
  skillSourcesCheckNow: "skillSources.checkNow",
  skillSourcesDecide: "skillSources.decide",
  skillUsageList: "skillUsage.list",
} as const;

export const ABODE_RPCS = [
  WsCustomizationsListRpc,
  WsCustomizationsReadFileRpc,
  WsCustomizationsWriteFileRpc,
  WsVoiceRpc,
  WsTailnetStatusRpc,
  WsSkillSourcesListRpc,
  WsSkillSourcesCheckNowRpc,
  WsSkillSourcesDecideRpc,
  WsSkillUsageListRpc,
] as const;
