// @effect-diagnostics nodeBuiltinImport:off - the state file is written atomically with rename.
/**
 * Daily (06:00 local) and on-demand check of the skill packs the Kit window follows. Undecided
 * changes stay listed; state is one JSON file under the state directory; a failed check keeps the
 * last good result.
 */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import {
  WS_METHODS,
  SkillSourcesError,
  type SkillChange,
  type SkillDecision,
  type SkillSourcesDecideInput,
  type SkillSourcesState,
  type SkillSourceStatus,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";

import { ServerConfig } from "../config.ts";
import {
  classifyLocal,
  diffSnapshots,
  estimateTokens,
  findSkills,
  folderHash,
  msUntilNextCheck,
  parseSkillMd,
  withKnownHash,
  worstLocalState,
  type RawChange,
  type Snapshot,
  type SnapshotSkill,
} from "./skillSourcesCore.ts";
import {
  LocalSkills,
  SkillSourceFetchError,
  SkillSourceFetcher,
  defaultLocalSkillDirs,
  fetcherLive,
  localSkillsFor,
} from "./skillSourcesIO.ts";

export interface SkillSourceDefinition {
  readonly id: string;
  readonly name: string;
  /** `owner/repo`; absent means no repo is known and the source is unsupported. */
  readonly repo?: string;
  /** Where the skills live inside the repo. */
  readonly prefix?: string;
  /** npm package whose version is tracked (`npx skills` installs). */
  readonly npm?: string;
}

const SKILL_SOURCES: ReadonlyArray<SkillSourceDefinition> = [
  { id: "matt", name: "Matt Pocock", repo: "mattpocock/skills", npm: "skills" },
  { id: "gstack", name: "gstack", repo: "garrytan/gstack" },
  { id: "pstack", name: "pstack", repo: "cursor/plugins", prefix: "pstack" },
  { id: "tstack", name: "tstack", repo: "t3dotgg/tstack" },
];

/** What "inherit" does on disk. A-062 provides the real installer; until then a decision is only recorded. */
export interface SkillInstallRequest {
  readonly source: SkillSourceDefinition;
  readonly changes: ReadonlyArray<Pick<SkillChange, "kind" | "key" | "name">>;
}

export class SkillInstaller extends Context.Service<
  SkillInstaller,
  { readonly install: (request: SkillInstallRequest) => Effect.Effect<void, SkillSourcesError> }
>()("t3/abode/SkillSources/SkillInstaller") {}

const SkillInstallerRecordOnly = Layer.succeed(SkillInstaller, {
  install: Effect.fn("SkillInstaller.recordOnly")(function* () {}),
});

interface SourceRecord {
  /** What the person last accepted (or skipped); changes are `latest` minus this. */
  readonly baseline: Snapshot;
  readonly latest: Snapshot;
  readonly npm?: { readonly latest: string; readonly seen: string };
  readonly lastCheckedAt?: string;
  readonly lastOkAt?: string;
  readonly failure?: string;
  readonly decisions: ReadonlyArray<SkillDecision>;
  /** Skills the person skipped; they never come back, whatever upstream does next. */
  readonly skipped?: ReadonlyArray<string>;
}

interface PersistedState {
  readonly version: 1;
  readonly sources: Readonly<Record<string, SourceRecord>>;
}

const EMPTY_RECORD: SourceRecord = { baseline: {}, latest: {}, decisions: [] };
const DECISIONS_KEPT = 200;
const SKILL_FETCH_CONCURRENCY = 4;

const toMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const readState = async (file: string): Promise<PersistedState> => {
  const parsed: unknown = JSON.parse(await NodeFSP.readFile(file, "utf8"));
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as PersistedState).version === 1 &&
    typeof (parsed as PersistedState).sources === "object"
  ) {
    return parsed as PersistedState;
  }
  throw new Error("unrecognized format");
};

const writeState = async (file: string, state: PersistedState) => {
  await NodeFSP.mkdir(NodePath.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await NodeFSP.writeFile(temp, JSON.stringify(state), "utf8");
  await NodeFSP.rename(temp, file);
};

export class SkillSources extends Context.Service<
  SkillSources,
  {
    readonly list: Effect.Effect<SkillSourcesState>;
    /** Checks every source now and returns the result; a source that fails keeps its last result. */
    readonly checkNow: Effect.Effect<SkillSourcesState>;
    readonly decide: (
      input: SkillSourcesDecideInput,
    ) => Effect.Effect<SkillSourcesState, SkillSourcesError>;
  }
>()("t3/abode/SkillSources") {}

const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

const makeWith = Effect.fn("SkillSources.make")(function* (stateFile: string) {
  const fetcher = yield* SkillSourceFetcher;
  const local = yield* LocalSkills;
  const installer = yield* SkillInstaller;
  const scope = yield* Effect.scope;
  const lock = yield* Semaphore.make(1);

  let state: PersistedState = yield* Effect.tryPromise({
    try: () => readState(stateFile),
    catch: toMessage,
  }).pipe(
    Effect.catch((reason) =>
      Effect.logWarning(`skill sources state starts empty (${stateFile}): ${reason}`).pipe(
        Effect.as({ version: 1, sources: {} } satisfies PersistedState),
      ),
    ),
  );
  let checking = false;

  const recordOf = (id: string): SourceRecord => state.sources[id] ?? EMPTY_RECORD;

  const save = Effect.fn("SkillSources.save")(function* (id: string, record: SourceRecord) {
    state = { version: 1, sources: { ...state.sources, [id]: record } };
    yield* Effect.tryPromise({
      try: () => writeState(stateFile, state),
      catch: toMessage,
    }).pipe(Effect.catch((message) => Effect.logWarning("skill sources state not saved", message)));
  });

  const pendingOf = Effect.fn("SkillSources.pending")(function* (record: SourceRecord) {
    const skipped = new Set(record.skipped);
    const all = yield* Effect.forEach(
      diffSnapshots(record.baseline, record.latest).filter((raw) => !skipped.has(raw.skill.key)),
      (raw) => Effect.map(toChange(raw), (change) => ({ raw, change })),
    );
    // A change to a skill the person does not have is not news; only new skills are offered.
    return all.filter(({ change }) => change.kind === "new" || change.local !== "none");
  });

  const changesOf = Effect.fn("SkillSources.changes")(function* (
    record: SourceRecord,
  ): Effect.fn.Return<ReadonlyArray<SkillChange>> {
    return (yield* pendingOf(record)).map(({ change }) => change);
  });

  const toChange = Effect.fn("SkillSources.toChange")(function* (change: RawChange) {
    const { skill } = change;
    const hashes = yield* local.hashesFor(skill.name, skill.files);
    return {
      kind: change.kind,
      key: skill.key,
      name: skill.name,
      description: skill.description,
      tokens: skill.tokens,
      local: worstLocalState(hashes.map((hash) => classifyLocal(hash, skill))),
    } satisfies SkillChange;
  });

  const statusOf = Effect.fn("SkillSources.status")(function* (
    source: SkillSourceDefinition,
  ): Effect.fn.Return<SkillSourceStatus> {
    const record = recordOf(source.id);
    return {
      id: source.id,
      name: source.name,
      ...(source.repo === undefined ? {} : { repo: source.repo }),
      supported: source.repo !== undefined,
      ...(record.lastCheckedAt === undefined ? {} : { lastCheckedAt: record.lastCheckedAt }),
      ...(record.lastOkAt === undefined ? {} : { lastOkAt: record.lastOkAt }),
      ...(record.failure === undefined ? {} : { failure: record.failure }),
      skillCount: Object.keys(record.latest).length,
      ...(source.npm !== undefined && record.npm !== undefined
        ? { npm: { package: source.npm, ...record.npm } }
        : {}),
      changes: yield* changesOf(record),
      decisions: record.decisions,
    };
  });

  const snapshotState = Effect.fn("SkillSources.state")(
    function* (): Effect.fn.Return<SkillSourcesState> {
      return { sources: yield* Effect.forEach(SKILL_SOURCES, statusOf), checking };
    },
  );

  const fetchSnapshot = Effect.fn("SkillSources.fetchSnapshot")(function* (
    source: SkillSourceDefinition & { readonly repo: string },
    previous: Snapshot,
  ): Effect.fn.Return<Snapshot, SkillSourceFetchError> {
    const entries = yield* fetcher.tree(source.repo);
    const found = findSkills(entries, {
      ...(source.prefix === undefined ? {} : { prefix: source.prefix }),
      rootName: source.repo.split("/").at(-1) ?? source.repo,
    });
    if (found.length === 0) {
      return yield* new SkillSourceFetchError({
        reason: `${source.repo}: no skills found (did the layout change?)`,
      });
    }
    const skills = yield* Effect.forEach(
      found,
      Effect.fn("SkillSources.fetchSkill")(function* (skill): Effect.fn.Return<
        SnapshotSkill,
        SkillSourceFetchError
      > {
        const hash = folderHash(skill.files);
        const before = previous[skill.key];
        if (before !== undefined && before.hash === hash) return before;
        const path = skill.key === "." ? "SKILL.md" : `${skill.key}/SKILL.md`;
        const meta = parseSkillMd(yield* fetcher.file(source.repo, path));
        return {
          key: skill.key,
          name: skill.name,
          description: meta.description,
          tokens: estimateTokens(skill.name, meta.description),
          hash,
          files: skill.files.map((file) => file.path),
          knownHashes: withKnownHash(before, hash),
        };
      }),
      { concurrency: SKILL_FETCH_CONCURRENCY },
    );
    return Object.fromEntries(skills.map((skill) => [skill.key, skill]));
  });

  const checkSource = Effect.fn("SkillSources.checkSource")(function* (
    source: SkillSourceDefinition,
  ) {
    if (source.repo === undefined) return;
    const repo = source.repo;
    const record = recordOf(source.id);
    const outcome = yield* Effect.gen(function* () {
      const latest = yield* fetchSnapshot({ ...source, repo }, record.latest);
      const npmVersion =
        source.npm === undefined ? undefined : yield* fetcher.npmVersion(source.npm);
      return { latest, npmVersion };
    }).pipe(Effect.result);
    const now = iso(yield* Clock.currentTimeMillis);
    if (outcome._tag === "Failure") {
      const { failure: _old, ...rest } = record;
      yield* save(source.id, {
        ...rest,
        lastCheckedAt: now,
        failure: `check failed: ${outcome.failure.message}`,
      });
      return;
    }
    const { latest, npmVersion } = outcome.success;
    const first = record.lastOkAt === undefined;
    const { failure: _cleared, ...rest } = record;
    // Upstream changes to skills the person never installed are accepted quietly.
    const baseline: Record<string, SnapshotSkill> = { ...(first ? latest : record.baseline) };
    for (const raw of diffSnapshots(baseline, latest)) {
      if (raw.kind === "new") continue;
      if ((yield* local.hashesFor(raw.skill.name, raw.skill.files)).length > 0) continue;
      if (raw.kind === "removed") delete baseline[raw.skill.key];
      else baseline[raw.skill.key] = raw.skill;
    }
    yield* save(source.id, {
      ...rest,
      // The first look is the starting point, not a pile of "new" skills.
      baseline,
      latest,
      ...(npmVersion === undefined
        ? {}
        : {
            npm: {
              latest: npmVersion,
              seen: first ? npmVersion : (record.npm?.seen ?? npmVersion),
            },
          }),
      lastCheckedAt: now,
      lastOkAt: now,
    });
  });

  const runChecks = lock.withPermits(1)(
    Effect.gen(function* () {
      checking = true;
      yield* Effect.forEach(SKILL_SOURCES, checkSource, { discard: true }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            checking = false;
          }),
        ),
      );
    }),
  );

  const decide = Effect.fn("SkillSources.decide")(function* (input: SkillSourcesDecideInput) {
    const source = SKILL_SOURCES.find((candidate) => candidate.id === input.sourceId);
    if (source === undefined) {
      return yield* new SkillSourcesError({
        failure: "unknown_source",
        message: `There is no skill source '${input.sourceId}'.`,
      });
    }
    const record = recordOf(source.id);
    const outstanding = yield* pendingOf(record);
    const takeAll = input.decision === "takeAll";
    let picked = outstanding;
    if (takeAll) {
      // Take all updates what is installed and unedited; new skills are chosen one by one.
      picked = outstanding.filter(
        ({ change }) => change.kind !== "new" && change.local !== "edited",
      );
    } else {
      if (input.key === undefined) {
        return yield* new SkillSourcesError({
          failure: "key_required",
          message: "Say which skill.",
        });
      }
      picked = outstanding.filter(({ change }) => change.key === input.key);
      if (picked.length === 0) {
        return yield* new SkillSourcesError({
          failure: "unknown_change",
          message: `'${input.key}' has no pending change in ${source.name}.`,
        });
      }
    }
    const kind: SkillDecision["decision"] = input.decision === "skip" ? "skip" : "inherit";
    if (kind === "inherit" && picked.some(({ change }) => change.local === "edited")) {
      return yield* new SkillSourcesError({
        failure: "local_edited",
        message: `'${input.key}' was edited here; merge it instead of overwriting.`,
      });
    }
    if (kind === "inherit" && picked.length > 0) {
      yield* installer.install({
        source,
        changes: picked.map(({ change }) => ({
          kind: change.kind,
          key: change.key,
          name: change.name,
        })),
      });
    }
    const baseline: Record<string, SnapshotSkill> = { ...record.baseline };
    for (const { raw } of picked) {
      if (raw.kind === "removed") delete baseline[raw.skill.key];
      else baseline[raw.skill.key] = raw.skill;
    }
    const now = iso(yield* Clock.currentTimeMillis);
    const decisions: SkillDecision[] = [
      ...picked.map(({ change }) => ({
        key: change.key,
        name: change.name,
        decision: kind,
        takeAll,
        decidedAt: now,
      })),
      ...record.decisions,
    ].slice(0, DECISIONS_KEPT);
    const remaining = outstanding.length - picked.length;
    yield* save(source.id, {
      ...record,
      baseline,
      decisions,
      ...(kind === "skip"
        ? {
            skipped: [
              ...new Set([...(record.skipped ?? []), ...picked.map(({ change }) => change.key)]),
            ],
          }
        : {}),
      ...(record.npm !== undefined && remaining === 0
        ? { npm: { latest: record.npm.latest, seen: record.npm.latest } }
        : {}),
    });
    return yield* snapshotState();
  });

  // Daily at 06:00 local; a check that was missed while the host was off runs shortly after start.
  const schedule = Effect.gen(function* () {
    while (true) {
      const now = yield* Clock.currentTimeMillis;
      const last = Math.max(
        0,
        ...Object.values(state.sources).map((record) =>
          record.lastCheckedAt === undefined ? 0 : Date.parse(record.lastCheckedAt),
        ),
      );
      yield* Effect.sleep(msUntilNextCheck(now, last === 0 ? null : last));
      yield* runChecks.pipe(
        Effect.catchCause((cause) => Effect.logError("daily skill source check failed", cause)),
      );
    }
  });
  yield* Effect.forkIn(schedule, scope);

  return SkillSources.of({
    list: snapshotState(),
    checkNow: runChecks.pipe(Effect.andThen(snapshotState())),
    decide: Effect.fn("SkillSources.decideLocked")(function* (input) {
      return yield* lock.withPermits(1)(decide(input));
    }),
  });
});

export const layerWith = (stateFile: string) => Layer.effect(SkillSources, makeWith(stateFile));

/** Live wiring: state in `<state dir>/abode/skill-sources.json`, GitHub and npm over HTTPS, the person's skill folders. */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    return layerWith(NodePath.join(config.stateDir, "abode", "skill-sources.json"));
  }),
).pipe(
  Layer.provide(Layer.succeed(SkillSourceFetcher, fetcherLive)),
  Layer.provide(Layer.succeed(LocalSkills, localSkillsFor(defaultLocalSkillDirs()))),
  Layer.provide(SkillInstallerRecordOnly),
);

/** The `skillSources.*` handlers, spread into `ws.ts` in one line. */
export const handlers = (service: SkillSources["Service"]) => ({
  [WS_METHODS.skillSourcesList]: () => service.list,
  [WS_METHODS.skillSourcesCheckNow]: () => service.checkNow,
  [WS_METHODS.skillSourcesDecide]: (input: SkillSourcesDecideInput) => service.decide(input),
});
