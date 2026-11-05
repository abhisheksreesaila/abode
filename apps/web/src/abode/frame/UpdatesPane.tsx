import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { SkillChange, SkillSourceStatus } from "@t3tools/contracts";
import { useState } from "react";

import { Spinner } from "~/components/ui/spinner";
import { useAtomCommand } from "~/state/use-atom-command";

import { buildKitSkills } from "../canvas/kit/kitModel";
import { useKitItems } from "../canvas/kit/kitState";
import { fillComposer } from "../composerFill";
import type { CustomizationsScope } from "../customizations/useCustomizationsScope";
import { skillSourcesCommands, useSkillSourcesState } from "./kitData";
import {
  groupChanges,
  mergePrompt,
  overlapHint,
  sourceSummary,
  takeAllTitle,
  updatesFooter,
} from "./updatesModel";

type Outcome = "inherit" | "skip" | "takeAll";

interface Decided {
  readonly sourceId: string;
  readonly change: SkillChange;
  readonly outcome: Outcome;
}

const failureText = (error: unknown) =>
  error instanceof Error ? error.message : "That did not work. Try again.";

function NewSkillCard(props: {
  readonly change: SkillChange;
  readonly overlap: string | null;
  readonly outcome: Outcome | null;
  readonly busy: boolean;
  readonly onDecide: (outcome: "inherit" | "skip") => void;
}) {
  const { change, overlap, outcome, busy, onDecide } = props;
  return (
    <article
      data-abode-upd-card=""
      data-decided={outcome ?? undefined}
      data-testid="updates-new-card"
    >
      <header>
        <b data-abode-upd-name="">{change.name}</b>
        <span data-abode-upd-cost="">+{change.tokens} tok</span>
      </header>
      <p>{change.description}</p>
      {overlap === null ? null : (
        <small data-abode-upd-overlap="">
          Looks like <b>{overlap}</b>, which you already have
        </small>
      )}
      {outcome === null ? (
        <div data-abode-upd-actions="">
          <button type="button" disabled={busy} onClick={() => onDecide("skip")}>
            Skip
          </button>
          <button type="button" data-primary="" disabled={busy} onClick={() => onDecide("inherit")}>
            Inherit
          </button>
        </div>
      ) : (
        <span data-abode-upd-outcome="">
          {outcome === "inherit" ? "Inherited" : "Skipped · won't ask again"}
        </span>
      )}
    </article>
  );
}

function TakeAllCard(props: {
  readonly changes: ReadonlyArray<SkillChange>;
  readonly taken: boolean;
  readonly busy: boolean;
  readonly onTakeAll: () => void;
}) {
  const { changes, taken, busy, onTakeAll } = props;
  return (
    <article
      data-abode-upd-card=""
      data-decided={taken ? "takeAll" : undefined}
      data-testid="updates-take-all-card"
    >
      <header>
        <b>{takeAllTitle(changes)}</b>
        <small>you haven't edited {changes.length === 1 ? "it" : "them"}</small>
      </header>
      <ul data-abode-upd-list="">
        {changes.map((change) => (
          <li key={change.key}>
            <b data-abode-upd-name="">{change.name}</b>
            <small>
              {change.kind === "removed" ? "Removed upstream · you keep your copy" : "Updated"}
            </small>
          </li>
        ))}
      </ul>
      {taken ? (
        <span data-abode-upd-outcome="">Updated</span>
      ) : (
        <div data-abode-upd-actions="">
          <button type="button" data-primary="" disabled={busy} onClick={onTakeAll}>
            Take all
          </button>
        </div>
      )}
    </article>
  );
}

function EditedCard(props: {
  readonly change: SkillChange;
  readonly canJam: boolean;
  readonly onMerge: () => void;
}) {
  const { change, canJam, onMerge } = props;
  return (
    <article data-abode-upd-card="" data-edited="" data-testid="updates-edited-card">
      <header>
        <b>
          you edited <span data-abode-upd-name="">{change.name}</span> · upstream changed it
        </b>
      </header>
      <p>Your copy is never overwritten. Ask the agent to merge the two.</p>
      <div data-abode-upd-actions="">
        <button type="button" data-primary="" disabled={!canJam} onClick={onMerge}>
          Merge in jam
        </button>
      </div>
    </article>
  );
}

function SourceBlock(props: {
  readonly source: SkillSourceStatus;
  readonly decided: ReadonlyArray<Decided>;
  readonly kit: ReadonlyArray<{ readonly name: string; readonly description: string }>;
  readonly busyKey: string | null;
  readonly error: string | null;
  readonly canJam: boolean;
  readonly onDecide: (decision: Outcome, key?: string) => void;
  readonly onMerge: (change: SkillChange) => void;
}) {
  const { source, decided, kit, busyKey, error, canJam, onDecide, onMerge } = props;
  const groups = groupChanges(source.changes);
  const decidedNew = decided.filter((entry) => entry.outcome !== "takeAll");
  const takenAll = decided.filter((entry) => entry.outcome === "takeAll");
  const outcomeOf = (key: string) => decidedNew.find((entry) => entry.change.key === key)?.outcome;
  const busy = busyKey !== null;
  if (
    source.changes.length === 0 &&
    decided.length === 0 &&
    source.failure === undefined &&
    error === null
  ) {
    return null;
  }
  return (
    <section data-abode-upd-source="" data-testid="updates-source">
      <header>
        <span data-abode-upd-avatar="" aria-hidden>
          {source.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b>{source.name}</b>
          {source.repo === undefined ? null : <code>{source.repo}</code>}
        </span>
        {source.changes.length === 0 ? null : <small>{sourceSummary(source)}</small>}
      </header>
      {source.failure === undefined ? null : (
        <p data-abode-upd-error="" role="alert">
          {source.failure}
        </p>
      )}
      {error === null ? null : (
        <p data-abode-upd-error="" role="alert">
          {error}
        </p>
      )}
      {groups.fresh.map((change) => (
        <NewSkillCard
          key={change.key}
          change={change}
          overlap={overlapHint(change, kit)}
          outcome={null}
          busy={busy}
          onDecide={(outcome) => onDecide(outcome, change.key)}
        />
      ))}
      {decidedNew.map((entry) => (
        <NewSkillCard
          key={`done|${entry.change.key}`}
          change={entry.change}
          overlap={null}
          outcome={outcomeOf(entry.change.key) ?? null}
          busy
          onDecide={() => undefined}
        />
      ))}
      {groups.takeAll.length > 0 ? (
        <TakeAllCard
          changes={groups.takeAll}
          taken={false}
          busy={busy}
          onTakeAll={() => onDecide("takeAll")}
        />
      ) : takenAll.length > 0 ? (
        <TakeAllCard
          changes={takenAll.map((entry) => entry.change)}
          taken
          busy
          onTakeAll={() => undefined}
        />
      ) : null}
      {groups.edited.map((change) => (
        <EditedCard
          key={change.key}
          change={change}
          canJam={canJam}
          onMerge={() => onMerge(change)}
        />
      ))}
    </section>
  );
}

/** The Updates tab: what the daily check found, grouped by source, one tap per decision. */
export function UpdatesPane(props: {
  readonly scope: CustomizationsScope;
  /** Merge in jam fills the composer, then moves to the Jam tab so the person can send it. */
  readonly onJam: () => void;
}) {
  const { scope, onJam } = props;
  const state = useSkillSourcesState(scope.environmentId);
  const { items } = useKitItems(scope);
  const kit = items === null ? [] : buildKitSkills(items);
  const decide = useAtomCommand(skillSourcesCommands.decide, { reportFailure: false });
  const checkNow = useAtomCommand(skillSourcesCommands.checkNow, { reportFailure: false });
  const [decided, setDecided] = useState<ReadonlyArray<Decided>>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  if (state === null) {
    return (
      <div data-abode-kit-note="" data-testid="kit-updates">
        <Spinner size="sm" /> Reading the last check…
      </div>
    );
  }

  const decideOn = async (source: SkillSourceStatus, outcome: Outcome, key?: string) => {
    setBusyKey(key ?? "all");
    setErrors((before) => ({ ...before, [source.id]: "" }));
    const result = await decide({
      environmentId: scope.environmentId,
      input: { sourceId: source.id, decision: outcome, ...(key === undefined ? {} : { key }) },
    });
    setBusyKey(null);
    if (isAtomCommandInterrupted(result)) return;
    if (result._tag === "Failure") {
      const message = failureText(squashAtomCommandFailure(result));
      setErrors((before) => ({ ...before, [source.id]: message }));
      return;
    }
    const groups = groupChanges(source.changes);
    const covered =
      outcome === "takeAll" ? groups.takeAll : groups.fresh.filter((c) => c.key === key);
    setDecided((before) => [
      ...before,
      ...covered.map((change) => ({ sourceId: source.id, change, outcome })),
    ]);
  };

  const runCheck = async () => {
    setChecking(true);
    setCheckError(null);
    const result = await checkNow({ environmentId: scope.environmentId, input: undefined });
    setChecking(false);
    if (isAtomCommandInterrupted(result)) return;
    if (result._tag === "Failure") setCheckError(failureText(squashAtomCommandFailure(result)));
  };

  const merge = (source: SkillSourceStatus, change: SkillChange) => {
    if (scope.threadRef === null) return;
    fillComposer(
      scope.threadRef,
      mergePrompt({
        sourceName: source.name,
        repo: source.repo,
        change,
        localPath: kit.find((skill) => skill.name === change.name)?.path,
      }),
    );
    onJam();
  };

  const footer = updatesFooter(state);
  const waiting = state.sources.reduce((sum, source) => sum + source.changes.length, 0);
  const isChecking = checking || state.checking;
  return (
    <div data-abode-updates="" data-testid="kit-updates">
      <div data-abode-upd-bar="">
        <span>
          {waiting === 0
            ? "No source changes are waiting."
            : `${waiting} ${waiting === 1 ? "change is" : "changes are"} waiting.`}
        </span>
        <button
          type="button"
          data-testid="updates-check-now"
          disabled={isChecking}
          onClick={() => void runCheck()}
        >
          {isChecking ? "Checking…" : "Check now"}
        </button>
      </div>
      {checkError === null ? null : (
        <p data-abode-upd-error="" role="alert">
          {checkError}
        </p>
      )}
      {state.sources.map((source) => (
        <SourceBlock
          key={source.id}
          source={source}
          decided={decided.filter((entry) => entry.sourceId === source.id)}
          kit={kit}
          busyKey={busyKey}
          error={errors[source.id] || null}
          canJam={scope.threadRef !== null}
          onDecide={(outcome, key) => void decideOn(source, outcome, key)}
          onMerge={(change) => merge(source, change)}
        />
      ))}
      <footer data-abode-upd-footer="">
        {footer.quiet.length === 0 ? null : <span>No changes: {footer.quiet.join(", ")}</span>}
        <span>Skipped earlier: {footer.skipped}</span>
      </footer>
    </div>
  );
}
