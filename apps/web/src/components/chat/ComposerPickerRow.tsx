import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import type { ReactNode } from "react";

import { useComposerDraftStore, type DraftId } from "~/composerDraftStore";
import { useScratchProject } from "~/hooks/useScratchProject";
import { useProject } from "~/state/entities";
import { useProjectWorkspaceColor } from "../sidebar/workspaceColorHooks";
import { ComposerControlChevron } from "./ComposerControl";
import { DraftProjectMenu, useDraftProjectPicker } from "./DraftProjectPicker";

/**
 * The top row of a draft's composer: which workspace the thread starts in and
 * which harness/model runs it, so both are one click away before the first
 * message. The workspace menu is the hero headline's own picker; the model
 * picker is passed in because the composer owns its state.
 */
export function ComposerPickerRow(props: {
  readonly draftId: DraftId;
  readonly modelPicker: ReactNode;
  /** True while a send is in flight, matching the model picker. */
  readonly disabled: boolean;
}) {
  const draft = useComposerDraftStore((store) => store.getDraftSession(props.draftId));
  const projectRef = draft ? scopeProjectRef(draft.environmentId, draft.projectId) : null;
  const project = useProject(projectRef);
  const picker = useDraftProjectPicker({
    draftId: props.draftId,
    activeProjectRef: projectRef,
    activeProjectTitle: project?.title ?? null,
  });
  const { scratchWorkspaceRootFor } = useScratchProject();
  const color = useProjectWorkspaceColor(project);
  const isScratch =
    project !== null && isScratchProject(project, scratchWorkspaceRootFor(project.environmentId));
  const label = isScratch ? "No project" : (picker.activeProjectDisplayName ?? "Choose a project");

  return (
    <div
      data-chat-composer-picker-row="true"
      className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5"
    >
      {picker.shouldShowProjectMenu ? (
        <DraftProjectMenu
          picker={picker}
          align="start"
          disabled={props.disabled}
          ariaLabel={`Workspace: ${label}`}
          label={
            <>
              {color ? (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color.color }}
                />
              ) : null}
              <span className="min-w-0 truncate">{label}</span>
              <ComposerControlChevron size="xs" />
            </>
          }
        />
      ) : null}
      {props.modelPicker}
    </div>
  );
}
