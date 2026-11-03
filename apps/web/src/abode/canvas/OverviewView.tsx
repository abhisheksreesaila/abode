import { useMachineInputs } from "../controlRoom/useMachineInputs";
import { OverviewMascot } from "./OverviewMascot";
import {
  heroCounts,
  machineColour,
  milestoneBar,
  overviewMachines,
  statusWord,
  type OverviewWorkspace,
} from "./overviewModel";
import { useLastSeenStore, useOverviewWorkspaces, useUsageMeters } from "./overviewState";
import type { CanvasWorkspace } from "./useCanvasWorkspaces";
import { usePlanFile } from "./usePlanFile";
import "./overview.css";

const METER_COLOUR: Record<string, string> = { claudeAgent: "#e07a52", codex: "#3ecf8e" };

function ModeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden data-cv-ov-mode="">
      <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" />
    </svg>
  );
}

/** Mounted only while the overview is open, so each row reads its plan.md only then (cached). */
function Row(props: {
  readonly row: OverviewWorkspace;
  readonly workspace: CanvasWorkspace;
  readonly onOpen: () => void;
}) {
  const { row, workspace } = props;
  const root = workspace.newSessionTarget;
  const plan = usePlanFile(root?.environmentId, root?.workspaceRoot, workspace.turnSignal);
  const bar = milestoneBar(plan);
  const status = statusWord(row);
  return (
    <button type="button" data-cv-ov-row="" data-group={row.group} onClick={props.onOpen}>
      <span data-cv-ov-name="">
        <ModeIcon />
        <b>{row.name}</b>
        <span>
          {row.sessions} {row.sessions === 1 ? "session" : "sessions"}
        </span>
      </span>
      <span data-cv-ov-strip="" data-finished={bar.finished ? "" : undefined}>
        <span data-cv-ov-seg="">
          {bar.segments.map((segment, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- segments have no identity beyond position
            <i key={index} data-seg={segment} />
          ))}
        </span>
        <span data-cv-ov-label="">{bar.label}</span>
        {bar.segments.length > 0 ? (
          <span data-cv-ov-count="">
            {bar.done}/{bar.segments.length}
          </span>
        ) : null}
      </span>
      <span data-cv-ov-status="" data-tone={status.tone}>
        {status.word}
      </span>
    </button>
  );
}

/** Zoomed-out view: every workspace on every machine, usage and what needs you (A-048). */
export function OverviewView(props: {
  readonly workspaces: ReadonlyArray<CanvasWorkspace>;
  readonly onSelect: (key: string) => void;
}) {
  const inputs = useOverviewWorkspaces(props.workspaces);
  const machines = overviewMachines(
    useMachineInputs().map((machine) => ({
      environmentId: machine.environmentId,
      label: machine.label,
      isPrimary: machine.route === "Local",
      online: machine.phase === "connected",
      cpu:
        machine.resources?.cpuUtilization == null
          ? null
          : Math.round(machine.resources.cpuUtilization * 100),
    })),
    inputs,
  );
  const meters = useUsageMeters();
  const lastSeenAt = useLastSeenStore((state) => state.lastSeenAt);
  const hero = heroCounts(inputs);
  const byKey = new Map(props.workspaces.map((workspace) => [workspace.key, workspace]));

  return (
    <section data-cv-ov="" aria-label="Overview">
      <div data-cv-ov-hero="">
        <p>
          <b data-tone="warn">{hero.need}</b> need you<i>·</i>
          <b data-tone="bad">{hero.red}</b> red<i>·</i>
          <b>-</b> milestones since last look<i>·</i>
          <b>{hero.running}</b> sessions running
        </p>
        <div data-cv-ov-meters="" aria-label="Usage, estimate">
          {meters.map((meter) => (
            <span key={meter.driver} data-cv-ov-meter="">
              <i
                data-cv-ov-dot=""
                style={{ background: METER_COLOUR[meter.driver] ?? "#a9a9b1" }}
              />
              {meter.name}
              <span data-cv-ov-bar="">
                <i
                  style={{
                    width: `${Math.min(100, meter.percent)}%`,
                    background: METER_COLOUR[meter.driver] ?? "#a9a9b1",
                  }}
                />
              </span>
              {Math.round(meter.percent)}%<small>estimate</small>
            </span>
          ))}
        </div>
      </div>
      {lastSeenAt !== null ? (
        <small data-cv-ov-seen="">
          last look{" "}
          {new Date(lastSeenAt).toLocaleString([], {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      ) : null}
      {machines.map((machine) => (
        <section
          key={machine.environmentId}
          data-cv-ov-mach=""
          style={{ "--mcol": machineColour(machine.label, machine.environmentId) } as never}
        >
          <header data-cv-ov-mh="">
            <OverviewMascot
              kind={machine.isPrimary ? "laptop" : "mini"}
              colour={machineColour(machine.label, machine.environmentId)}
              cpu={machine.cpu}
            />
            <span data-cv-ov-mt="">
              <b>{machine.label}</b>
              <span data-online={machine.online ? "" : undefined}>
                {machine.online ? "online" : "offline"} · {machine.agents}{" "}
                {machine.agents === 1 ? "agent" : "agents"}
              </span>
            </span>
            <span data-cv-ov-grow="" />
            {machine.cpu === null ? null : (
              <>
                <span data-cv-ov-bar="">
                  <i style={{ width: `${machine.cpu}%` }} />
                </span>
                <span data-cv-ov-cpu="">{machine.cpu}%</span>
              </>
            )}
          </header>
          {machine.rows.map((row) => {
            const workspace = byKey.get(row.key);
            return workspace ? (
              <Row
                key={row.key}
                row={row}
                workspace={workspace}
                onOpen={() => props.onSelect(row.key)}
              />
            ) : null;
          })}
        </section>
      ))}
    </section>
  );
}
