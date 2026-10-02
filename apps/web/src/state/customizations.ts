import {
  createAtomCommandScheduler,
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";

const writeScheduler = createAtomCommandScheduler();

/**
 * Claude customizations of a workspace. Only the list is a cached query. File
 * contents go through commands so nothing (the global `.claude.json` holds
 * secrets) is retained in an atom cache after the editor closes.
 */
export const customizationsEnvironment = {
  list: createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
    label: "environment-data:customizations:list",
    tag: WS_METHODS.customizationsList,
    staleTimeMs: 5_000,
    idleTtlMs: 60_000,
  }),
  readFile: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:customizations:read-file",
    tag: WS_METHODS.customizationsReadFile,
  }),
  writeFile: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:customizations:write-file",
    tag: WS_METHODS.customizationsWriteFile,
    scheduler: writeScheduler,
    concurrency: {
      mode: "serial",
      key: ({ environmentId, input }) => JSON.stringify([environmentId, input.cwd, input.path]),
    },
  }),
};
