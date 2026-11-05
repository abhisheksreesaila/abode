import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { isValidElement, useState, type ReactNode } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useThreadShell } from "~/state/entities";
import { useAtomCommand } from "~/state/use-atom-command";

import { SourceBadge } from "../../canvas/kit/KitSkillDetail";
import { buildKitSkills, skillCopies, skillTokens } from "../../canvas/kit/kitModel";
import { useKitItems } from "../../canvas/kit/kitState";
import "../../canvas/kit/kit.css";
import { customizationsEnvironment } from "../../customizations/customizationsState";
import { useRefreshProviderSkills } from "../../customizations/useRefreshProviderSkills";
import { skillPruneCommands, useHostHomePath } from "../../frame/kitData";
import { isKitProject } from "../../frame/kitMode";
import { useActiveCustomizationsScope } from "../../customizations/useCustomizationsScope";
import { deriveWorkspaceThreadState } from "../../shell/threadState";
import { parsePruneBlock, pruneHeadline, rowTokens } from "./pruneModel";
import { setPruneOutcome, usePruneOutcome } from "./pruneOutcomes";

/** The fenced text inside the `<code>` element the markdown renderer hands over. */
export function codeText(children: ReactNode): string {
  const inner = isValidElement<{ children?: unknown }>(children) ? children.props.children : "";
  return (typeof inner === "string" ? inner : "").replace(/\n$/, "");
}

/** The ```abode-prune block as a pick list in Kit threads; elsewhere a plain code block. */
export function PruneBlock(props: { readonly children: ReactNode }) {
  const code = codeText(props.children);
  const scope = useActiveCustomizationsScope();
  const shell = useThreadShell(scope?.threadRef ?? null);
  const homePath = useHostHomePath(scope?.environmentId);
  if (!scope || scope.borrowed || !scope.threadRef || !isKitProject(scope.cwd, homePath)) {
    return <pre>{props.children}</pre>;
  }
  return (
    <PruneCard
      code={code}
      environmentId={scope.environmentId}
      cwd={scope.cwd}
      threadRef={scope.threadRef}
      isStreaming={
        shell !== null && deriveWorkspaceThreadState(shell, undefined).attention === "running"
      }
    />
  );
}

const failureText = (error: unknown) =>
  error instanceof Error ? error.message : "That did not work. Try again.";

function PruneCard(props: {
  readonly code: string;
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly threadRef: ScopedThreadRef;
  readonly isStreaming: boolean;
}) {
  const { code, environmentId, cwd, threadRef, isStreaming } = props;
  const { items } = useKitItems({ environmentId, cwd });
  const outcomeKey = `${threadRef.threadId}\n${code}`;
  const outcome = usePruneOutcome(outcomeKey);
  const cut = useAtomCommand(skillPruneCommands.cut, { reportFailure: false });
  const restore = useAtomCommand(skillPruneCommands.restore, { reportFailure: false });
  const refreshSkills = useRefreshProviderSkills({
    environmentId,
    threadRef,
    workspaceRoot: cwd,
  });
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = new Map((items ? buildKitSkills(items) : []).map((skill) => [skill.name, skill]));
  const rows = parsePruneBlock(code).map((row) => {
    const skill = known.get(row.name);
    const copies = items ? skillCopies(items, row.name) : [];
    return {
      row,
      skill,
      copies: copies.length,
      tokens: rowTokens(
        row,
        copies.map((copy) => skillTokens({ name: copy.name, description: copy.description ?? "" })),
      ),
      // Until the list arrives nothing can be cut: a name is not "unknown" yet, just unchecked.
      cuttable: skill !== undefined,
    };
  });
  const picked = rows.filter((entry) => entry.cuttable && !unticked.has(entry.row.name));
  const saved = picked.reduce((sum, entry) => sum + entry.tokens, 0);

  const afterMove = () => {
    appAtomRegistry.refresh(customizationsEnvironment.list({ environmentId, input: { cwd } }));
    refreshSkills();
  };

  const run = async (
    command: typeof cut | typeof restore,
    names: ReadonlyArray<string>,
  ): Promise<{ done: ReadonlyArray<string>; note: string | null } | null> => {
    setBusy(true);
    setError(null);
    const result = await command({ environmentId, input: { names } });
    setBusy(false);
    if (isAtomCommandInterrupted(result)) return null;
    if (result._tag === "Failure") {
      setError(failureText(squashAtomCommandFailure(result)));
      return null;
    }
    afterMove();
    const { done, skipped } = result.value;
    const note =
      skipped.length === 0 ? null : skipped.map((s) => `${s.name}: ${s.reason}`).join("; ");
    return { done, note };
  };

  const onCut = async () => {
    const result = await run(
      cut,
      picked.map((entry) => entry.row.name),
    );
    if (result === null) return;
    if (result.done.length === 0) setError(result.note ?? "Nothing was moved.");
    else setPruneOutcome(outcomeKey, { moved: result.done, note: result.note });
  };

  const onRestore = async () => {
    if (outcome === null) return;
    const result = await run(restore, outcome.moved);
    if (result === null) return;
    const left = outcome.moved.filter((name) => !result.done.includes(name));
    if (left.length > 0) setError(result.note ?? "Some skills could not be restored.");
    setPruneOutcome(outcomeKey, left.length === 0 ? null : { moved: left, note: result.note });
  };

  if (outcome !== null) {
    return (
      <div data-abode-prune="" data-state="cut" data-testid="prune-card">
        <p data-abode-prune-head="">
          Moved {outcome.moved.length} to trash
          <button
            type="button"
            data-abode-prune-act=""
            data-testid="prune-restore"
            disabled={busy}
            onClick={() => void onRestore()}
          >
            Restore
          </button>
        </p>
        <p data-abode-prune-names="">{outcome.moved.join(" · ")}</p>
        {outcome.note ? <p data-abode-prune-note="">Left alone: {outcome.note}</p> : null}
        {error ? <p data-abode-prune-error="">{error}</p> : null}
      </div>
    );
  }

  return (
    <div data-abode-prune="" data-testid="prune-card">
      <p data-abode-prune-head="">
        <span>{pruneHeadline(picked.length, saved)}</span>
        <button
          type="button"
          data-abode-prune-act=""
          data-testid="prune-cut"
          disabled={busy || isStreaming || picked.length === 0}
          onClick={() => void onCut()}
        >
          Cut {picked.length}
        </button>
      </p>
      <div role="list" data-abode-prune-rows="">
        {rows.map(({ row, skill, copies, tokens, cuttable }) => (
          <div role="listitem" key={row.name} data-testid="prune-row">
            <label data-abode-prune-row="" data-disabled={cuttable ? undefined : ""}>
              <input
                type="checkbox"
                disabled={!cuttable}
                checked={cuttable && !unticked.has(row.name)}
                onChange={(event) =>
                  setUnticked((before) => {
                    const next = new Set(before);
                    if (event.target.checked) next.delete(row.name);
                    else next.add(row.name);
                    return next;
                  })
                }
              />
              <code>{row.name}</code>
              {skill ? <SourceBadge id={skill.source} /> : null}
              {copies > 1 ? <small data-abode-prune-copies="">{copies} copies</small> : null}
              <span data-abode-prune-reason="">
                {items !== null && !cuttable ? "not in your kit" : row.reason}
              </span>
              {items !== null && !cuttable ? null : <b data-abode-prune-tok="">−{tokens} tok</b>}
            </label>
          </div>
        ))}
      </div>
      {error ? <p data-abode-prune-error="">{error}</p> : null}
    </div>
  );
}
