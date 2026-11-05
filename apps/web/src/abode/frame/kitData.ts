import { useAtomValue } from "@effect/atom-react";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import {
  WS_METHODS,
  type EnvironmentId,
  type SkillSourcesState,
  type SkillTrashResult,
  type SkillUsageListResult,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";

import { connectionAtomRuntime } from "~/connection/runtime";

/** The daily source check's last result. Re-read on focus; the host updates it once a day. */
const skillSourcesAtom = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:abode:skill-sources",
  tag: WS_METHODS.skillSourcesList,
  staleTimeMs: 30_000,
  idleTtlMs: 60_000,
});

/**
 * Last use of each skill, from the host's session logs. `scan: false` only fetches the host's
 * home folder (cheap); `scan: true` reads the logs (seconds the first time, then cached).
 */
export const skillUsageAtom = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:abode:skill-usage",
  tag: WS_METHODS.skillUsageList,
  staleTimeMs: 60_000,
  idleTtlMs: 5 * 60_000,
});

const NO_HOME = Atom.make(AsyncResult.initial<SkillUsageListResult, never>(false));

/** The host's home folder, once it has answered (the cheap, no-scan call). */
export function useHostHomePath(environmentId: EnvironmentId | undefined): string | undefined {
  const result = useAtomValue(
    environmentId === undefined
      ? NO_HOME
      : skillUsageAtom({ environmentId, input: { scan: false } }),
  );
  return Option.getOrUndefined(AsyncResult.value(result))?.homePath;
}

const NO_SOURCES = Atom.make(AsyncResult.initial<SkillSourcesState, never>(false));

/** The daily check's last result for a machine; null until it has answered. */
export function useSkillSourcesState(
  environmentId: EnvironmentId | null | undefined,
): SkillSourcesState | null {
  const result = useAtomValue(
    environmentId == null ? NO_SOURCES : skillSourcesAtom({ environmentId, input: undefined }),
  );
  return Option.getOrNull(AsyncResult.value(result));
}

/** Both commands answer with the new state; re-reading the list keeps the badge and feed in step. */
export const skillSourcesCommands = {
  checkNow: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:abode:skill-sources-check",
    tag: WS_METHODS.skillSourcesCheckNow,
    onSuccess: ({ environmentId }, registry) =>
      Effect.sync(() => registry.refresh(skillSourcesAtom({ environmentId, input: undefined }))),
  }),
  decide: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:abode:skill-sources-decide",
    tag: WS_METHODS.skillSourcesDecide,
    onSuccess: ({ environmentId }, registry) =>
      Effect.sync(() => registry.refresh(skillSourcesAtom({ environmentId, input: undefined }))),
  }),
};

/** What is in the host's skill trash (cut by "Prune by jam"), newest first. */
const skillTrashAtom = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:abode:skill-trash",
  tag: WS_METHODS.skillPruneTrash,
  staleTimeMs: 10_000,
  idleTtlMs: 60_000,
});

const NO_TRASH = Atom.make(AsyncResult.initial<SkillTrashResult, never>(false));

/** The trash list for a machine; null until it has answered. */
export function useSkillTrash(
  environmentId: EnvironmentId | null | undefined,
): SkillTrashResult | null {
  const result = useAtomValue(
    environmentId == null ? NO_TRASH : skillTrashAtom({ environmentId, input: undefined }),
  );
  return Option.getOrNull(AsyncResult.value(result));
}

/** Prune by jam: moving skills to the host's trash and back. The caller refreshes the skill lists it shows. */
export const skillPruneCommands = {
  cut: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:abode:skill-prune-cut",
    tag: WS_METHODS.skillPruneCut,
    onSuccess: ({ environmentId }, registry) =>
      Effect.sync(() => registry.refresh(skillTrashAtom({ environmentId, input: undefined }))),
  }),
  restore: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "environment-data:abode:skill-prune-restore",
    tag: WS_METHODS.skillPruneRestore,
    onSuccess: ({ environmentId }, registry) =>
      Effect.sync(() => registry.refresh(skillTrashAtom({ environmentId, input: undefined }))),
  }),
};
