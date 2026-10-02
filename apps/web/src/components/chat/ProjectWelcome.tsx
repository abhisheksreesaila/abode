import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, type CSSProperties, type ReactNode } from "react";

import { useComposerDraftStore, type DraftId } from "~/composerDraftStore";
import { useThreadShellsForProjectRefs } from "~/state/entities";
import { useEnvironments } from "~/state/environments";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useEnvironmentQuery } from "~/state/query";
import { vcsEnvironment } from "~/state/vcs";
import { useComposerHandleContext } from "../../composerHandleContext";
import { resolveBranchToolbarValue, resolveEffectiveEnvMode } from "../BranchToolbar.logic";
import { buildThreadRouteParams } from "../../threadRoutes";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { useProjectWorkspaceColor } from "../sidebar/workspaceColorHooks";
import {
  buildStarterPrompts,
  pickProjectEmoji,
  shortenHomePath,
  summarizeProjectThreads,
} from "./projectWelcome.logic";
import { useProjectReadmeWelcome } from "./useProjectReadmeWelcome";

type ProjectWelcomeProject = Pick<
  EnvironmentProject,
  "environmentId" | "id" | "workspaceRoot" | "repositoryIdentity"
> & { readonly title: string };

const MetaChip = ({ children, tooltip }: { children: ReactNode; tooltip?: string }) => {
  const chip = (
    <span className="max-w-full truncate rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-muted-foreground text-xs">
      {children}
    </span>
  );
  if (!tooltip) return chip;
  return (
    <Tooltip>
      <TooltipTrigger render={chip} />
      <TooltipPopup side="top">{tooltip}</TooltipPopup>
    </Tooltip>
  );
};

function StarterCard(props: {
  readonly accent: string;
  readonly title: string;
  readonly hint: string;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onSelect}
      style={{ "--card-accent": props.accent } as CSSProperties}
      className="pointer-events-auto grid min-w-0 cursor-pointer gap-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left outline-none transition-colors hover:border-(--card-accent) focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:border-border"
    >
      <span className="truncate font-semibold text-foreground text-sm">{props.title}</span>
      <span className="truncate text-muted-foreground text-xs">{props.hint}</span>
    </button>
  );
}

/**
 * The welcome for a new thread in a project: emoji, title, where the thread
 * will run, and four starter cards. It renders at once; the README only adds
 * its emoji and tagline when it has been read, so a missing README or an
 * offline host gives the same hero without them.
 */
export function ProjectWelcome(props: {
  readonly draftId: DraftId | null;
  readonly project: ProjectWelcomeProject;
}) {
  const { project, draftId } = props;
  const readme = useProjectReadmeWelcome(project);
  const color = useProjectWorkspaceColor(project);
  const navigate = useNavigate();
  const composerHandle = useComposerHandleContext();
  const { environments } = useEnvironments();
  const projectRefs = useMemo(
    () => [scopeProjectRef(project.environmentId, project.id)],
    [project.environmentId, project.id],
  );
  const shells = useThreadShellsForProjectRefs(projectRefs);
  const draft = useComposerDraftStore((store) => (draftId ? store.getDraftSession(draftId) : null));
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);

  // The branch the composer's own branch picker would show: the checkout's
  // current branch, or the draft's chosen one. Unknown means no chip.
  const worktreePath = draft?.worktreePath ?? null;
  const branchStatus = useEnvironmentQuery(
    vcsEnvironment.status({
      environmentId: project.environmentId,
      input: { cwd: worktreePath ?? project.workspaceRoot },
    }),
  );
  const branch = resolveBranchToolbarValue({
    envMode: resolveEffectiveEnvMode({
      activeWorktreePath: worktreePath,
      hasServerThread: false,
      draftThreadEnvMode: draft?.envMode,
    }),
    activeWorktreePath: worktreePath,
    activeThreadBranch: draft?.branch ?? null,
    currentGitBranch: branchStatus.data?.refName ?? null,
  });

  const summary = useMemo(() => summarizeProjectThreads(shells), [shells]);
  const latest = summary.latest;

  const environmentLabel =
    environments.find((environment) => environment.environmentId === project.environmentId)
      ?.label ?? null;
  const prompts = buildStarterPrompts(project.title);
  // A card never replaces what is already typed: it adds its line below.
  const fillComposer = (text: string) => {
    if (!draftId) return;
    const existing = useComposerDraftStore.getState().getComposerDraft(draftId)?.prompt ?? "";
    setPrompt(draftId, existing.trim() === "" ? text : `${existing.replace(/\s+$/, "")}\n${text}`);
    requestAnimationFrame(() => composerHandle?.current?.focusAtEnd());
  };
  const accent = color?.color ?? "var(--chip-blue)";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2 text-center sm:gap-3">
      <div aria-hidden="true" className="shorter:hidden text-4xl leading-none">
        {readme?.emoji ?? pickProjectEmoji(project.title)}
      </div>
      <h1
        aria-label={`What should we build in ${project.title} today?`}
        className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl [text-wrap:balance]"
      >
        What should we build in{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 55%, var(--chip-purple)))`,
          }}
        >
          {project.title}
        </span>{" "}
        today?
      </h1>
      {readme?.tagline ? (
        <p className="shorter:hidden max-w-[56ch] text-muted-foreground text-sm">
          {readme.tagline}
        </p>
      ) : null}
      <div className="shorter:hidden flex flex-wrap justify-center gap-2">
        <MetaChip tooltip={project.workspaceRoot}>
          📁 {shortenHomePath(project.workspaceRoot)}
        </MetaChip>
        {environmentLabel ? <MetaChip>🖥 {environmentLabel}</MetaChip> : null}
        {branch ? <MetaChip>⎇ {branch}</MetaChip> : null}
        <MetaChip>
          {summary.total === 0
            ? "No threads yet"
            : `🟢 ${summary.total} ${summary.total === 1 ? "thread" : "threads"}${
                summary.running > 0 ? `, ${summary.running} running` : ""
              }`}
        </MetaChip>
      </div>
      <div className="short:hidden mt-1 grid w-full max-w-xl grid-cols-2 gap-2">
        <StarterCard
          accent="var(--chip-blue)"
          title="✨ Add a feature"
          hint="Describe it and I'll plan it first"
          onSelect={() => fillComposer(prompts.feature)}
        />
        <StarterCard
          accent="var(--ws-5, #f48771)"
          title="🐛 Fix a bug"
          hint="Paste the error or what you saw"
          onSelect={() => fillComposer(prompts.bug)}
        />
        <StarterCard
          accent="var(--chip-safe)"
          title="📖 Explain the code"
          hint={`A tour of how ${project.title} works`}
          onSelect={() => fillComposer(prompts.explain)}
        />
        <StarterCard
          accent="var(--chip-purple)"
          title="🧭 Pick up where we left off"
          hint={
            latest
              ? `"${latest.title}" was last, ${formatRelativeTimeLabel(latest.updatedAt)}`
              : "No threads yet"
          }
          disabled={!latest}
          onSelect={() => {
            if (!latest) return;
            void navigate({
              to: "/$environmentId/$threadId",
              params: buildThreadRouteParams(scopeThreadRef(latest.environmentId, latest.id)),
            });
          }}
        />
      </div>
    </div>
  );
}
