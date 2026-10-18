import type { ScopedThreadRef } from "@t3tools/contracts";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { SidebarInset } from "~/components/ui/sidebar";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useNowMinute } from "~/hooks/useNowMinute";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatRelativeTime } from "~/timestampFormat";

import { buildMachineRows, filterRowsByMachine, type MachineRow } from "./machineRows";
import { useControlRoomRows } from "./useControlRoomRows";
import { useMachineInputs } from "./useMachineInputs";
import { summarizeRows, type WorkspaceRow, type WorkspaceStatus } from "./workspaceRows";
import "./controlRoom.css";

const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  "needs-you": "Needs you",
  failed: "Failed",
  running: "Running",
  done: "Done",
  idle: "Idle",
};

function ageLabel(activityAt: string | null): string {
  if (activityAt === null) return "—";
  const age = formatRelativeTime(activityAt);
  return age ? (age.suffix ? age.value : "now") : "—";
}

/**
 * The abode home page: one table of workspaces. It replaces the new-thread draft
 * that "/" used to open, so a glance shows what runs, how far along, and what waits.
 */
export function ControlRoomView() {
  const router = useRouter();
  const { workspaces, rows: allRows, refByKey } = useControlRoomRows();
  const machines = buildMachineRows(useMachineInputs(), workspaces);
  const [chosenMachine, setChosenMachine] = useState<string | null>(null);
  // A machine that disappeared (unpaired) cannot keep filtering the table.
  const machineFilter = machines.some((machine) => machine.environmentId === chosenMachine)
    ? chosenMachine
    : null;
  const rows = filterRowsByMachine(allRows, machineFilter);
  const filteredMachine = machines.find((machine) => machine.environmentId === machineFilter);
  // Re-render each minute so the activity ages do not freeze.
  useNowMinute();

  const open = (ref: ScopedThreadRef) => {
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(ref),
    });
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <div data-abode-cr-top="">
          <WorkspacePageHeader electron={isElectron} className="border-b border-border">
            <h1 data-abode-cr-title="">Control room</h1>
            <span data-abode-cr-summary="">{summarizeRows(rows)}</span>
          </WorkspacePageHeader>
        </div>
        <main data-abode-control-room="">
          <h2 data-abode-cr-section="">Workspaces</h2>
          {filteredMachine ? (
            <div data-abode-cr-chips="">
              <button type="button" onClick={() => setChosenMachine(null)}>
                All machines
              </button>
              <button type="button" aria-pressed="true" onClick={() => setChosenMachine(null)}>
                {filteredMachine.name}
              </button>
            </div>
          ) : null}
          <div data-abode-cr-table="">
            <table>
              <thead>
                <tr>
                  <th scope="col">Workspace</th>
                  <th scope="col" data-wide="">
                    Status
                  </th>
                  <th scope="col" data-wide="">
                    Progress
                  </th>
                  <th scope="col" data-wide="">
                    Agents
                  </th>
                  <th scope="col" data-wide="">
                    Machine
                  </th>
                  <th scope="col" data-wide="" data-end="">
                    Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <WorkspaceTableRow
                    key={row.key}
                    row={row}
                    openRef={row.openSessionKey ? (refByKey.get(row.openSessionKey) ?? null) : null}
                    onOpen={open}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <h2 data-abode-cr-section="">Machines</h2>
          <div data-abode-cr-table="">
            <table>
              <thead>
                <tr>
                  <th scope="col">Machine</th>
                  <th scope="col" data-wide="">
                    Status
                  </th>
                  <th scope="col" data-wide="">
                    CPU
                  </th>
                  <th scope="col" data-wide="">
                    Memory
                  </th>
                  <th scope="col" data-wide="">
                    Agents
                  </th>
                  <th scope="col" data-wide="" data-end="">
                    Workspaces
                  </th>
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => (
                  <MachineTableRow
                    key={machine.environmentId}
                    machine={machine}
                    chosen={machine.environmentId === machineFilter}
                    onToggle={() =>
                      setChosenMachine(
                        machine.environmentId === machineFilter ? null : machine.environmentId,
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </SidebarInset>
  );
}

function WorkspaceTableRow(props: {
  readonly row: WorkspaceRow;
  readonly openRef: ScopedThreadRef | null;
  readonly onOpen: (ref: ScopedThreadRef) => void;
}) {
  const { row, openRef, onOpen } = props;
  const { progress } = row;
  const secondary = `${row.agents} agents · ${row.machines.join(", ")} · ${ageLabel(row.activityAt)}`;
  return (
    <tr
      data-status={row.status}
      data-clickable={openRef !== null}
      onClick={openRef ? () => onOpen(openRef) : undefined}
    >
      <td>
        {openRef ? (
          <Link
            data-abode-cr-name=""
            to="/$environmentId/$threadId"
            params={buildThreadRouteParams(openRef)}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {row.name}
          </Link>
        ) : (
          <span data-abode-cr-name="">{row.name}</span>
        )}
        {row.question ? <div data-abode-cr-question="">{row.question}</div> : null}
        <div data-abode-cr-narrow="">
          <span data-abode-cr-pill={row.status}>{STATUS_LABEL[row.status]}</span>
          {progress ? <span>{progress.percent}%</span> : null}
          <span>{secondary}</span>
        </div>
      </td>
      <td data-wide="">
        <span data-abode-cr-pill={row.status}>{STATUS_LABEL[row.status]}</span>
      </td>
      <td data-wide="">
        {progress ? (
          <div data-abode-cr-progress="" data-tone={progress.tone}>
            <div
              data-abode-cr-bar=""
              role="progressbar"
              aria-label={`${row.name} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <span data-abode-cr-mono="">
              {progress.percent}% · {progress.done}/{progress.total}
            </span>
          </div>
        ) : (
          <span data-abode-cr-muted="">{row.agents > 0 ? "No task list" : "Nothing running"}</span>
        )}
      </td>
      <td data-wide="" data-abode-cr-mono="">
        {row.agents}
      </td>
      <td data-wide="" data-abode-cr-muted="">
        {row.machines.join(", ")}
      </td>
      <td data-wide="" data-end="" data-abode-cr-mono="" data-abode-cr-muted="">
        {ageLabel(row.activityAt)}
      </td>
    </tr>
  );
}

function LoadBar(props: { readonly label: string; readonly percent: number | null }) {
  const { label, percent } = props;
  if (percent === null) return <span data-abode-cr-muted="">—</span>;
  return (
    <div data-abode-cr-progress="" data-load="">
      <div
        data-abode-cr-bar=""
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <span data-abode-cr-mono="">{percent}%</span>
    </div>
  );
}

const MACHINE_STATUS_LABEL = { online: "Online", connecting: "Connecting", offline: "Offline" };

function MachineTableRow(props: {
  readonly machine: MachineRow;
  readonly chosen: boolean;
  readonly onToggle: () => void;
}) {
  const { machine, chosen, onToggle } = props;
  const pill = (
    <span data-abode-cr-pill={machine.status}>{MACHINE_STATUS_LABEL[machine.status]}</span>
  );
  const cpu = machine.cpu === null ? "—" : `${machine.cpu}%`;
  const memory = machine.memory === null ? "—" : `${machine.memory}%`;
  return (
    <tr data-clickable="true" data-chosen={chosen} onClick={onToggle}>
      <td>
        <button
          type="button"
          data-abode-cr-name=""
          aria-pressed={chosen}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {machine.name}
        </button>
        <div data-abode-cr-route="">{machine.route}</div>
        <div data-abode-cr-narrow="">
          {pill}
          <span>
            CPU {cpu} · Mem {memory} · {machine.agents} agents · {machine.workspaces} workspaces
          </span>
        </div>
      </td>
      <td data-wide="">{pill}</td>
      <td data-wide="">
        <LoadBar label={`${machine.name} CPU`} percent={machine.cpu} />
      </td>
      <td data-wide="">
        <LoadBar label={`${machine.name} memory`} percent={machine.memory} />
      </td>
      <td data-wide="" data-abode-cr-mono="">
        {machine.agents}
      </td>
      <td data-wide="" data-end="" data-abode-cr-mono="" data-abode-cr-muted="">
        {machine.workspaces}
      </td>
    </tr>
  );
}
