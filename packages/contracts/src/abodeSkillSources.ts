import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";

import { EnvironmentAuthorizationError } from "./auth.ts";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * The daily check of the skill packs the Kit window follows (mattpocock/skills, gstack, ...).
 * The server fetches each pack's skill folders, diffs them against the last snapshot the person
 * has seen, and keeps the outstanding changes until they decide.
 */
export const SkillChangeKind = Schema.Literals(["new", "updated", "removed"]);
export type SkillChangeKind = typeof SkillChangeKind.Type;

/**
 * How the installed copy (in `~/.claude/skills`, `~/.agents/skills` or `~/.codex/skills`) relates
 * to upstream: `none` not installed, `same` as upstream now, `outdated` an older upstream version
 * (safe to update), `edited` differs from every upstream version seen (never overwrite).
 */
export const SkillLocalState = Schema.Literals(["none", "same", "outdated", "edited"]);
export type SkillLocalState = typeof SkillLocalState.Type;

export const SkillChange = Schema.Struct({
  kind: SkillChangeKind,
  /** Folder path inside the repo; unique within a source. */
  key: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  /** The SKILL.md description (of the removed skill, for `removed`). */
  description: Schema.String,
  /** Approximate context cost of the skill's name and description, in tokens. */
  tokens: Schema.Number,
  local: SkillLocalState,
});
export type SkillChange = typeof SkillChange.Type;

export const SkillDecisionKind = Schema.Literals(["inherit", "skip"]);
export type SkillDecisionKind = typeof SkillDecisionKind.Type;

export const SkillDecision = Schema.Struct({
  key: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  decision: SkillDecisionKind,
  /** True when it came from "take all". */
  takeAll: Schema.Boolean,
  decidedAt: Schema.String,
});
export type SkillDecision = typeof SkillDecision.Type;

export const SkillSourceStatus = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  /** `owner/repo`; absent when no repo is known (the source is then unsupported). */
  repo: Schema.optional(TrimmedNonEmptyString),
  supported: Schema.Boolean,
  /** ISO time of the last attempt, successful or not. */
  lastCheckedAt: Schema.optional(Schema.String),
  /** ISO time of the last attempt that worked. */
  lastOkAt: Schema.optional(Schema.String),
  /** Set when the last attempt failed ("check failed"); `changes` is then the last good result. */
  failure: Schema.optional(Schema.String),
  skillCount: Schema.Number,
  npm: Schema.optional(
    Schema.Struct({
      package: TrimmedNonEmptyString,
      latest: TrimmedNonEmptyString,
      /** The version the person last accepted; differs from `latest` when a release is pending. */
      seen: TrimmedNonEmptyString,
    }),
  ),
  changes: Schema.Array(SkillChange),
  /** Most recent first. */
  decisions: Schema.Array(SkillDecision),
});
export type SkillSourceStatus = typeof SkillSourceStatus.Type;

export const SkillSourcesState = Schema.Struct({
  sources: Schema.Array(SkillSourceStatus),
  checking: Schema.Boolean,
});
export type SkillSourcesState = typeof SkillSourcesState.Type;

export const SkillSourcesDecideInput = Schema.Struct({
  sourceId: TrimmedNonEmptyString,
  decision: Schema.Literals(["inherit", "skip", "takeAll"]),
  /** Required for inherit and skip; takeAll covers every outstanding change that is not edited. */
  key: Schema.optional(TrimmedNonEmptyString),
});
export type SkillSourcesDecideInput = typeof SkillSourcesDecideInput.Type;

export const SkillSourcesFailure = Schema.Literals([
  "unknown_source",
  "unknown_change",
  "key_required",
  /** Inherit refused: the installed copy was edited, so it needs a merge, not an overwrite. */
  "local_edited",
  "failed",
]);
export type SkillSourcesFailure = typeof SkillSourcesFailure.Type;

export class SkillSourcesError extends Schema.TaggedError<SkillSourcesError>()(
  "SkillSourcesError",
  {
    failure: SkillSourcesFailure,
    message: TrimmedNonEmptyString,
  },
) {}

export const WsSkillSourcesListRpc = Rpc.make("skillSources.list", {
  success: SkillSourcesState,
  error: EnvironmentAuthorizationError,
});

export const WsSkillSourcesCheckNowRpc = Rpc.make("skillSources.checkNow", {
  success: SkillSourcesState,
  error: EnvironmentAuthorizationError,
});

export const WsSkillSourcesDecideRpc = Rpc.make("skillSources.decide", {
  payload: SkillSourcesDecideInput,
  success: SkillSourcesState,
  error: Schema.Union([SkillSourcesError, EnvironmentAuthorizationError]),
});

/**
 * When each skill was last used, read from the providers' own session logs on the host
 * (`~/.claude/projects/**` Skill tool calls). `scan: false` is the cheap call: it only returns
 * `homePath`, which is how the client finds the Kit project (a project rooted at the home folder).
 */
export const SkillUsageListInput = Schema.Struct({
  scan: Schema.optional(Schema.Boolean),
});
export type SkillUsageListInput = typeof SkillUsageListInput.Type;

export const SkillUsageEntry = Schema.Struct({
  /** The skill's name, without a plugin prefix. */
  name: TrimmedNonEmptyString,
  /** ISO time of the most recent use found in any log. */
  lastUsedAt: Schema.String,
  uses: Schema.Number,
});
export type SkillUsageEntry = typeof SkillUsageEntry.Type;

export const SkillUsageListResult = Schema.Struct({
  homePath: TrimmedNonEmptyString,
  /** False when the call did not read the logs. Absent entries then mean "not looked up". */
  scanned: Schema.Boolean,
  skills: Schema.Array(SkillUsageEntry),
});
export type SkillUsageListResult = typeof SkillUsageListResult.Type;

export const WsSkillUsageListRpc = Rpc.make("skillUsage.list", {
  payload: SkillUsageListInput,
  success: SkillUsageListResult,
  error: EnvironmentAuthorizationError,
});

/**
 * "Prune by jam": the Kit moves skills the person ticked into `~/.claude/skills/.trash` (cut) and
 * back to where they were (restore). Per-name outcomes, so one bad name does not stop the rest.
 */
export const SkillPruneInput = Schema.Struct({
  names: Schema.Array(TrimmedNonEmptyString).check(Schema.isMaxLength(200)),
});
export type SkillPruneInput = typeof SkillPruneInput.Type;

export const SkillPruneResult = Schema.Struct({
  /** Names that were moved. */
  done: Schema.Array(TrimmedNonEmptyString),
  /** Names left alone, each with the reason shown to the person. */
  skipped: Schema.Array(Schema.Struct({ name: Schema.String, reason: TrimmedNonEmptyString })),
});
export type SkillPruneResult = typeof SkillPruneResult.Type;

export const WsSkillPruneCutRpc = Rpc.make("skillPrune.cut", {
  payload: SkillPruneInput,
  success: SkillPruneResult,
  error: EnvironmentAuthorizationError,
});

export const WsSkillPruneRestoreRpc = Rpc.make("skillPrune.restore", {
  payload: SkillPruneInput,
  success: SkillPruneResult,
  error: EnvironmentAuthorizationError,
});
