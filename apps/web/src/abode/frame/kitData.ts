import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "~/connection/runtime";

/** The daily source check's last result. Re-read on focus; the host updates it once a day. */
export const skillSourcesAtom = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:abode:skill-sources",
  tag: WS_METHODS.skillSourcesList,
  staleTimeMs: 30_000,
  idleTtlMs: 60_000,
});

/**
 * Last use of each skill, from the host's session logs. `scan: false` only fetches the host's
 * home folder (cheap); `scan: true` reads the logs (seconds the first time, then cached).
 */
export const skillUsageAtom = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:abode:skill-usage",
  tag: WS_METHODS.skillUsageList,
  staleTimeMs: 60_000,
  idleTtlMs: 5 * 60_000,
});
