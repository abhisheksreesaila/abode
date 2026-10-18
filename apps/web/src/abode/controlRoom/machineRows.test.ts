import { describe, expect, it } from "vite-plus/test";

import {
  buildMachineRows,
  filterRowsByMachine,
  machineRouteLabel,
  type MachineInput,
} from "./machineRows";
import type { SessionSummary, WorkspaceInput } from "./workspaceRows";

const machine = (environmentId: string, over: Partial<MachineInput> = {}): MachineInput => ({
  environmentId,
  label: environmentId,
  route: "Local",
  phase: "connected",
  resources: null,
  ...over,
});
const session = (key: string, environmentId: string, over: Partial<SessionSummary> = {}) =>
  ({
    key,
    environmentId,
    environmentLabel: environmentId,
    state: { attention: null, failed: false },
    activityAt: "2026-10-17T10:00:00.000Z",
    runningSubagents: 0,
    ...over,
  }) satisfies SessionSummary;
const workspace = (key: string, sessions: SessionSummary[]): WorkspaceInput => ({
  key,
  name: key,
  sessions,
});
const running = { attention: "running", failed: false } as const;

describe("buildMachineRows", () => {
  it("shows cpu and memory load of an online machine as whole percents", () => {
    const [row] = buildMachineRows(
      [
        machine("local", {
          resources: {
            cpuUtilization: 0.424,
            availableMemoryBytes: 390,
            totalMemoryBytes: 1000,
          },
        }),
      ],
      [],
    );
    expect(row).toMatchObject({ status: "online", cpu: 42, memory: 61 });
  });

  it("leaves load out when resources are unavailable or the machine is offline", () => {
    const rows = buildMachineRows(
      [
        machine("old", { resources: null }),
        machine("nocpu", {
          resources: { cpuUtilization: null, availableMemoryBytes: 500, totalMemoryBytes: 1000 },
        }),
        machine("down", {
          phase: "offline",
          resources: { cpuUtilization: 0.5, availableMemoryBytes: 500, totalMemoryBytes: 1000 },
        }),
      ],
      [],
    );
    expect(rows.map((row) => [row.environmentId, row.cpu, row.memory])).toEqual([
      ["old", null, null],
      ["nocpu", null, 50],
      ["down", null, null],
    ]);
  });

  it("maps connection phases to online, connecting and offline", () => {
    const status = (phase: MachineInput["phase"]) =>
      buildMachineRows([machine("m", { phase })], [])[0]?.status;
    expect(status("connected")).toBe("online");
    expect(status("connecting")).toBe("connecting");
    expect(status("reconnecting")).toBe("connecting");
    expect(status("offline")).toBe("offline");
    expect(status("available")).toBe("offline");
    expect(status("error")).toBe("offline");
  });

  it("counts running agents and workspaces per machine, including a workspace on two", () => {
    const rows = buildMachineRows(
      [machine("local"), machine("mac"), machine("cloud")],
      [
        workspace("a", [
          session("a1", "local", { state: running, runningSubagents: 2 }),
          session("a2", "mac", { state: running }),
        ]),
        workspace("b", [session("b1", "local")]),
      ],
    );
    expect(rows.map((row) => [row.environmentId, row.agents, row.workspaces])).toEqual([
      ["local", 3, 2],
      ["mac", 1, 1],
      ["cloud", 0, 0],
    ]);
  });
});

describe("filterRowsByMachine", () => {
  const rows = [
    { key: "a", environmentIds: ["local", "mac"] },
    { key: "b", environmentIds: ["local"] },
  ];
  it("keeps workspaces that have a session on the machine", () => {
    expect(filterRowsByMachine(rows, "mac").map((row) => row.key)).toEqual(["a"]);
    expect(filterRowsByMachine(rows, "local").map((row) => row.key)).toEqual(["a", "b"]);
  });
  it("keeps everything without a filter", () => {
    expect(filterRowsByMachine(rows, null)).toHaveLength(2);
  });
});

describe("machineRouteLabel", () => {
  it("names how a machine is reached", () => {
    expect(machineRouteLabel({ isPrimary: true, relayManaged: false, displayUrl: null })).toBe(
      "Local",
    );
    expect(
      machineRouteLabel({ isPrimary: false, relayManaged: true, displayUrl: "relay.example" }),
    ).toBe("Relay");
    expect(
      machineRouteLabel({
        isPrimary: false,
        relayManaged: false,
        displayUrl: "mac.tail1.ts.net:3773",
      }),
    ).toBe("Tailscale");
    expect(
      machineRouteLabel({ isPrimary: false, relayManaged: false, displayUrl: "100.64.0.7:3773" }),
    ).toBe("Tailscale");
    expect(
      machineRouteLabel({ isPrimary: false, relayManaged: false, displayUrl: "192.168.1.5:3773" }),
    ).toBe("192.168.1.5:3773");
    expect(machineRouteLabel({ isPrimary: false, relayManaged: false, displayUrl: null })).toBe(
      "Remote",
    );
  });
});
