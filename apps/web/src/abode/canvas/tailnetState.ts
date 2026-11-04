import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "~/connection/runtime";

/** The host's Tailscale peers. Re-read when the guide opens and on "Check again", never on a timer. */
export const tailnetStatusAtom = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:abode:tailnet-status",
  tag: WS_METHODS.tailnetStatus,
  staleTimeMs: 0,
  idleTtlMs: 60_000,
});
