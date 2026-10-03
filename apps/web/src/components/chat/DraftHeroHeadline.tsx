import type { DraftId } from "~/composerDraftStore";
import type { ScopedProjectRef } from "@t3tools/contracts";

import { useDraftProjectPicker } from "./DraftProjectPicker";
import { ProjectWelcome } from "./ProjectWelcome";

interface DraftHeroHeadlineProps {
  readonly draftId: DraftId | null;
  readonly activeProjectRef: ScopedProjectRef | null;
  readonly activeProjectTitle: string | null;
}

export function DraftHeroHeadline({
  draftId,
  activeProjectRef,
  activeProjectTitle,
}: DraftHeroHeadlineProps) {
  const picker = useDraftProjectPicker({ draftId, activeProjectRef, activeProjectTitle });
  const {
    canChooseProject,
    hasResolvedProject,
    isScratchDraft,
    openAddProject,
    shouldShowProjectMenu,
    activeProject,
    activeProjectDisplayName,
  } = picker;
  // The composer's picker row owns choosing the workspace; the headline only
  // names it. With nothing to choose from, it still offers to add a project.
  const projectSelector = shouldShowProjectMenu ? (
    <span>{activeProjectDisplayName ?? "Choose a project"}</span>
  ) : (
    <button
      type="button"
      onClick={openAddProject}
      className="pointer-events-auto inline cursor-pointer border-muted-foreground/35 border-b border-dotted text-muted-foreground/60 transition-colors hover:border-muted-foreground/60 hover:text-muted-foreground/80 focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {activeProjectTitle ?? "Add a project"}
    </button>
  );

  // The composer hero is a sentence, so the heading's accessible name must be
  // a complete sentence too. The project picker is a control rendered inline
  // in the h1; without an explicit label its widget state bleeds into the
  // announced phrase.
  const headingLabel = isScratchDraft
    ? "What should we work on?"
    : hasResolvedProject
      ? `What should we build in ${activeProjectDisplayName}?`
      : canChooseProject
        ? `${activeProjectDisplayName ?? "Choose a project"} to start`
        : "Add a project to start";

  const plainHeadline = (
    <h1
      aria-label={headingLabel}
      className="w-full text-center font-normal text-2xl text-foreground tracking-tight sm:text-3xl"
    >
      {isScratchDraft ? (
        <>What should we work on?</>
      ) : hasResolvedProject ? (
        <>What should we build in {projectSelector}?</>
      ) : canChooseProject ? (
        <>{projectSelector} to start</>
      ) : (
        <>Add a project to start</>
      )}
    </h1>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
      {hasResolvedProject && !isScratchDraft && activeProject ? (
        <ProjectWelcome
          project={{ ...activeProject, title: activeProjectDisplayName ?? activeProject.title }}
        />
      ) : (
        plainHeadline
      )}
    </div>
  );
}
