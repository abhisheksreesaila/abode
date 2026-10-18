import type { ScopedThreadRef } from "@t3tools/contracts";
import { Link, useRouter } from "@tanstack/react-router";

import { SidebarInset } from "~/components/ui/sidebar";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useNowMinute } from "~/hooks/useNowMinute";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatRelativeTime } from "~/timestampFormat";

import { useTranscriptModeStore } from "../transcript/transcriptModeStore";
import { useControlRoomRows } from "./useControlRoomRows";
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
  const { rows, refByKey } = useControlRoomRows();
  // Re-render each minute so the activity ages do not freeze.
  useNowMinute();

  const open = (ref: ScopedThreadRef) => {
    useTranscriptModeStore.getState().setMode("calm");
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(ref),
    });
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        {isElectron ? <WorkspacePageHeader electron /> : null}
        <main data-abode-control-room="">
          <header data-abode-cr-heading="">
            <h1>Control room</h1>
            <span>{summarizeRows(rows)}</span>
          </header>
          <h2 data-abode-cr-section="">Workspaces</h2>
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
              useTranscriptModeStore.getState().setMode("calm");
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
          <div data-abode-cr-progress="" data-status={row.status}>
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
