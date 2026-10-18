import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { useContext, useEffect } from "react";

import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { serverEnvironment } from "~/state/server";

import { machineRouteLabel, type MachineInput, type MachineResources } from "./machineRows";

const POLL_MS = 15_000;
const NO_RESOURCES: ReadonlyMap<string, MachineResources> = new Map();

// Keyed by content (callers derive the list every render). Idle TTL 0: leaving the
// page drops the subscriptions.
const resourcesAtom = Atom.family((environmentIdsKey: string) =>
  Atom.make((get) => {
    const snapshots = new Map<string, MachineResources>();
    for (const environmentId of environmentIdsKey === ""
      ? []
      : (environmentIdsKey.split("\n") as EnvironmentId[])) {
      const result = get(serverEnvironment.hostResources({ environmentId, input: {} }));
      if (result._tag === "Success") snapshots.set(environmentId, result.value);
    }
    return snapshots as ReadonlyMap<string, MachineResources>;
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("abode-control-room-host-resources")),
);

/**
 * One input per connected environment for the Machines table. Host resources are read
 * and re-polled only for machines that are connected, and only while the page using
 * this hook is mounted.
 */
export function useMachineInputs(): ReadonlyArray<MachineInput> {
  const registry = useContext(RegistryContext);
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();

  const connectedIds = environments
    .filter((environment) => environment.connection.phase === "connected")
    .map((environment) => environment.environmentId);
  const connectedKey = connectedIds.join("\n");
  const resources = useAtomValue(resourcesAtom(connectedKey));

  useEffect(() => {
    if (connectedKey === "") return;
    const ids = connectedKey.split("\n") as EnvironmentId[];
    const timer = setInterval(() => {
      for (const environmentId of ids) {
        registry.refresh(serverEnvironment.hostResources({ environmentId, input: {} }));
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [connectedKey, registry]);

  return environments.map((environment) => ({
    environmentId: environment.environmentId,
    label: environment.label,
    route: machineRouteLabel({
      isPrimary: environment.environmentId === primaryEnvironmentId,
      relayManaged: environment.relayManaged,
      displayUrl: environment.displayUrl,
    }),
    phase: environment.connection.phase,
    resources:
      (connectedIds.length === 0 ? NO_RESOURCES : resources).get(environment.environmentId) ?? null,
  }));
}
