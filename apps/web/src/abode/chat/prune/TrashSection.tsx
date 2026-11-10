import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useState } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useAtomCommand } from "~/state/use-atom-command";

import { customizationsEnvironment } from "../../customizations/customizationsState";
import type { CustomizationsScope } from "../../customizations/useCustomizationsScope";
import { useRefreshProviderSkills } from "../../customizations/useRefreshProviderSkills";
import { skillPruneCommands, useSkillTrash } from "../../frame/kitData";
import { lastUsedLabel } from "../../frame/kitMode";
import { forgetPruned } from "./pruneOutcomes";

/** "In trash · N": what a cut moved away, each with a way back. Quiet; absent when empty. */
export function TrashSection(props: {
  readonly scope: CustomizationsScope;
  readonly nowMs: number;
}) {
  const { scope, nowMs } = props;
  const { environmentId, cwd, threadRef } = scope;
  const trash = useSkillTrash(environmentId);
  const restore = useAtomCommand(skillPruneCommands.restore, { reportFailure: false });
  const refreshSkills = useRefreshProviderSkills({ environmentId, threadRef, workspaceRoot: cwd });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (trash === null || trash.entries.length === 0) return null;

  const onRestore = async (name: string) => {
    setBusy(name);
    setError(null);
    const result = await restore({ environmentId, input: { names: [name] } });
    setBusy(null);
    if (isAtomCommandInterrupted(result)) return;
    if (result._tag === "Failure") {
      const failure = squashAtomCommandFailure(result);
      setError(failure instanceof Error ? failure.message : "That did not work. Try again.");
      return;
    }
    const { done, skipped } = result.value;
    if (done.length > 0) {
      forgetPruned(done);
      appAtomRegistry.refresh(customizationsEnvironment.list({ environmentId, input: { cwd } }));
      refreshSkills();
    }
    if (skipped[0]) setError(`${skipped[0].name}: ${skipped[0].reason}`);
  };

  return (
    <section data-abode-trash="" aria-label="In trash" data-testid="kit-trash">
      <h4>In trash · {trash.entries.length}</h4>
      {trash.entries.map((entry) => (
        <div key={`${entry.name}-${entry.movedAt}`} data-abode-trash-row="">
          <code>{entry.name}</code>
          <small>
            cut {lastUsedLabel(new Date(entry.movedAt).toISOString(), nowMs)}
            {entry.paths.length > 1 ? ` · ${entry.paths.length} copies` : ""}
          </small>
          <button
            type="button"
            data-abode-prune-act=""
            data-testid="kit-trash-restore"
            disabled={busy !== null}
            onClick={() => void onRestore(entry.name)}
          >
            Restore
          </button>
        </div>
      ))}
      {error ? <p data-abode-prune-error="">{error}</p> : null}
    </section>
  );
}
