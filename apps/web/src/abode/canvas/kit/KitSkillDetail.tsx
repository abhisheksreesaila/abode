import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { buildThreadRouteParams } from "~/threadRoutes";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useAtomCommand } from "~/state/use-atom-command";

import { describeCustomizationsError } from "../../customizations/customizationsModel";
import { customizationsEnvironment } from "../../customizations/customizationsState";
import type { CustomizationsScope } from "../../customizations/useCustomizationsScope";
import { useRefreshProviderSkills } from "../../customizations/useRefreshProviderSkills";
import { fillComposer } from "../../composerFill";
import { askClaudeAction } from "./askClaude";
import { CATEGORIES, SOURCES, type KitSkill } from "./kitModel";

const AGENT_NAME = { claude: "Claude Code", codex: "Codex" } as const;

type Load =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly text: string };

/**
 * The SKILL.md viewer and editor. Reads and writes through the Customizations service, which
 * decides what may be written; the service has no delete, so there is no Remove here.
 */
export function KitSkillDetail(props: {
  readonly scope: CustomizationsScope;
  readonly skill: KitSkill;
  readonly onClose: () => void;
}) {
  const { scope, skill, onClose } = props;
  const { environmentId, cwd } = scope;
  const router = useRouter();
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const refreshSkills = useRefreshProviderSkills({
    environmentId,
    threadRef: scope.threadRef,
    workspaceRoot: cwd,
  });
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the skill file from the host when the viewer opens on it
  useEffect(() => {
    let cancelled = false;
    void readFile({ environmentId, input: { cwd, path: skill.path } }).then((result) => {
      if (cancelled || isAtomCommandInterrupted(result)) return;
      setLoad(
        result._tag === "Success"
          ? { status: "ready", text: result.value.contents }
          : {
              status: "error",
              message: describeCustomizationsError(squashAtomCommandFailure(result)),
            },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [cwd, environmentId, readFile, skill.path]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Escape closes the open viewer
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const text = load.status === "ready" ? load.text : "";
  const category = CATEGORIES.find((entry) => entry.id === skill.category);
  const source = SOURCES[skill.source];

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await writeFile({
      environmentId,
      input: { cwd, path: skill.path, contents: draft },
    });
    setSaving(false);
    if (result._tag === "Success") {
      setLoad({ status: "ready", text: draft });
      setEditing(false);
      appAtomRegistry.refresh(customizationsEnvironment.list({ environmentId, input: { cwd } }));
      refreshSkills();
      return;
    }
    if (isAtomCommandInterrupted(result)) return;
    setError(describeCustomizationsError(squashAtomCommandFailure(result)));
  };

  const isDraft = useComposerDraftStore((store) =>
    scope.threadRef ? store.getDraftSessionByRef(scope.threadRef) !== null : false,
  );
  const ask = askClaudeAction({ hasThreadRef: scope.threadRef !== null, isDraft });
  const askClaude = () => {
    if (ask.kind === "disabled" || !scope.threadRef) return;
    fillComposer(scope.threadRef, `Change the ${skill.name} skill (${skill.path}): `);
    if (ask.kind === "prompt-and-open") {
      void router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(scope.threadRef),
      });
    }
    onClose();
  };

  return (
    <div
      data-cvk-det=""
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div data-cvk-dm="" role="dialog" aria-label={`${skill.name} SKILL.md`}>
        <div data-cvk-dh="">
          <i data-cvk-cd="" style={{ background: category?.color }} />
          <b>{skill.name}</b>
          <SourceBadge id={skill.source} />
          <span data-cvk-sp="" />
          <button type="button" data-cvk-x="" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div data-cvk-meta="">
          <span>{category?.label}</span>
          <span>{source.by}</span>
          <span>{skill.harnesses.map((harness) => AGENT_NAME[harness]).join(" · ")}</span>
        </div>
        {load.status === "loading" ? <pre data-cvk-md="">Loading…</pre> : null}
        {load.status === "error" ? <pre data-cvk-md="">{load.message}</pre> : null}
        {load.status === "ready" && editing ? (
          <textarea
            data-cvk-md=""
            aria-label="SKILL.md"
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}
        {load.status === "ready" && !editing ? <pre data-cvk-md="">{text}</pre> : null}
        {error ? <div data-cvk-error="">{error}</div> : null}
        <div data-cvk-row="">
          {editing ? (
            <>
              <button
                type="button"
                data-cvk-btn="fill"
                disabled={saving || draft === text}
                onClick={() => void save()}
              >
                Save
              </button>
              <button
                type="button"
                data-cvk-btn=""
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-cvk-btn=""
                disabled={load.status !== "ready"}
                onClick={() => {
                  setDraft(text);
                  setEditing(true);
                }}
              >
                Edit SKILL.md
              </button>
              <button
                type="button"
                data-cvk-btn=""
                disabled={ask.kind === "disabled"}
                onClick={askClaude}
              >
                Ask Claude to change it
              </button>
              {ask.kind === "disabled" ? <span data-cvk-hint="">{ask.reason}</span> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function SourceBadge(props: { readonly id: keyof typeof SOURCES }) {
  const source = SOURCES[props.id];
  return (
    <span data-cvk-src="" style={{ "--sc": source.color } as React.CSSProperties}>
      <i />
      {source.name}
    </span>
  );
}
