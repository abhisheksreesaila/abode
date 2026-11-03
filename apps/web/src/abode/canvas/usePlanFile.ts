import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";

import { useFilesystemReadAccess } from "~/state/filesystem";
import { projectEnvironment } from "~/state/projects";
import { revisionedQuery } from "~/state/revisionedQuery";

import type { PlanFileState } from "./planBlock";

const PLAN_PATH = "docs/plan.md";
const NO_READ = Atom.make(AsyncResult.initial<never, never>(false));

export interface PlanFile extends PlanFileState {
  readonly pending: boolean;
}

/**
 * docs/plan.md of a project root through the Files panel's read (`projects.readFile`, which
 * needs the connection's `filesystem:read` scope). `turnSignal` is the workspace's finished-run
 * marker: a new one refetches the file once, so the block follows the agents without polling.
 */
export function usePlanFile(
  environmentId: EnvironmentId | undefined,
  cwd: string | undefined,
  turnSignal: string,
): PlanFile {
  const access = useFilesystemReadAccess(environmentId ?? null);
  const enabled = environmentId !== undefined && cwd !== undefined && access.canReadFiles;
  const atom = enabled
    ? projectEnvironment.readFile({
        environmentId,
        input: { cwd, relativePath: PLAN_PATH, allowMissing: true },
      })
    : NO_READ;
  const result = useAtomValue(revisionedQuery(atom, enabled ? turnSignal : undefined));
  const data = Option.getOrUndefined(AsyncResult.value(result));
  const file =
    data === undefined ? null : { exists: data.exists !== false, contents: data.contents };
  const readError =
    result._tag === "Failure"
      ? ((Cause.squash(result.cause) as { message?: string }).message ??
        "Could not read docs/plan.md.")
      : null;
  const error =
    !access.isPending && !access.canReadFiles
      ? (access.error ?? "This connection cannot read host files.")
      : readError;
  return {
    file,
    error,
    pending: access.isPending || (enabled && result.waiting && file === null),
  };
}
