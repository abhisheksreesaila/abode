/**
 * The Control room's Machines table as plain data: one row per environment, with its
 * load (when the host reports it) and the agents and workspaces running on it.
 */
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";

import type { WorkspaceInput } from "./workspaceRows";

export type MachineStatus = "online" | "connecting" | "offline";

export interface MachineResources {
  /** 0..1, or null when the host cannot sample it yet. */
  readonly cpuUtilization: number | null;
  readonly availableMemoryBytes: number;
  readonly totalMemoryBytes: number;
}

export interface MachineInput {
  readonly environmentId: string;
  readonly label: string;
  /** "Local", "Tailscale", "Relay" or the address; see `machineRouteLabel`. */
  readonly route: string;
  readonly phase: EnvironmentConnectionPhase;
  /** Null until a snapshot arrives, or when the host is too old to report one. */
  readonly resources: MachineResources | null;
}

export interface MachineRow {
  readonly environmentId: string;
  readonly name: string;
  readonly route: string;
  readonly status: MachineStatus;
  /** Whole percent, or null for "—". */
  readonly cpu: number | null;
  readonly memory: number | null;
  readonly agents: number;
  readonly workspaces: number;
}

function machineStatus(phase: EnvironmentConnectionPhase): MachineStatus {
  if (phase === "connected") return "online";
  if (phase === "connecting" || phase === "reconnecting") return "connecting";
  return "offline";
}

export function buildMachineRows(
  machines: ReadonlyArray<MachineInput>,
  workspaces: ReadonlyArray<WorkspaceInput>,
): MachineRow[] {
  return machines.map((machine): MachineRow => {
    const status = machineStatus(machine.phase);
    const resources = status === "online" ? machine.resources : null;
    const onMachine = workspaces
      .map((workspace) =>
        workspace.sessions.filter((session) => session.environmentId === machine.environmentId),
      )
      .filter((sessions) => sessions.length > 0);
    const sessions = onMachine.flat();
    return {
      environmentId: machine.environmentId,
      name: machine.label,
      route: machine.route,
      status,
      cpu: resources?.cpuUtilization == null ? null : Math.round(resources.cpuUtilization * 100),
      memory:
        resources === null || resources.totalMemoryBytes === 0
          ? null
          : Math.round(
              ((resources.totalMemoryBytes - resources.availableMemoryBytes) /
                resources.totalMemoryBytes) *
                100,
            ),
      agents:
        sessions.filter((session) => session.state.attention === "running").length +
        sessions.reduce((sum, session) => sum + session.runningSubagents, 0),
      workspaces: onMachine.length,
    };
  });
}

/** Workspaces with a session on the chosen machine; all of them without one. */
export function filterRowsByMachine<Row extends { readonly environmentIds: ReadonlyArray<string> }>(
  rows: ReadonlyArray<Row>,
  environmentId: string | null,
): ReadonlyArray<Row> {
  return environmentId === null
    ? rows
    : rows.filter((row) => row.environmentIds.includes(environmentId));
}

function hostOf(displayUrl: string): string | null {
  // SSH targets display as `user@host`; everything else is an http(s) base URL.
  if (!displayUrl.includes("://")) return displayUrl.split("@").at(-1) || null;
  try {
    return new URL(displayUrl).hostname || null;
  } catch {
    return null;
  }
}

/** Tailscale names end in .ts.net; its addresses are the CGNAT range 100.64.0.0/10. */
function isTailscaleHost(host: string): boolean {
  if (host.endsWith(".ts.net")) return true;
  const octets = host.split(".").map(Number);
  return (
    octets.length === 4 &&
    octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    octets[0] === 100 &&
    octets[1]! >= 64 &&
    octets[1]! <= 127
  );
}

/** How a machine is reached, for the small line under its name. */
export function machineRouteLabel(input: {
  readonly isPrimary: boolean;
  readonly relayManaged: boolean;
  readonly displayUrl: string | null;
}): string {
  if (input.isPrimary) return "Local";
  if (input.relayManaged) return "Relay";
  const host = input.displayUrl === null ? null : hostOf(input.displayUrl);
  if (host === null) return "Remote";
  return isTailscaleHost(host) ? "Tailscale" : host;
}
