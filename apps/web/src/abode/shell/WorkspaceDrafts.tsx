import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import { SquarePenIcon, XIcon } from "lucide-react";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  composerDraftHasUserContent,
  DraftId,
  useComposerDraftStore,
  type ComposerThreadDraftState,
} from "~/composerDraftStore";
import { discardComposerDraft } from "~/lib/discardComposerDraft";
import { useAbodeActiveRoute, useAbodeSidebar } from "./sidebarContext";
import { projectRefKey, visibleDraftRows, type ProjectRefLike } from "./workspaceModel";

function draftPreview(composer: ComposerThreadDraftState): string {
  const firstLine =
    replaceComposerContextReferences(composer.prompt, (occurrence) => occurrence.label)
      .trim()
      .split("\n", 1)[0] ?? "";
  if (firstLine.length > 0) return firstLine;
  const attachments =
    Math.max(composer.images.length, composer.persistedAttachments.length) +
    composer.files.length +
    composer.terminalContexts.length +
    composer.previewAnnotations.length +
    composer.reviewComments.length;
  return `${attachments} attachment${attachments === 1 ? "" : "s"}`;
}

const DraftRow = memo(function DraftRow({ draftId }: { draftId: string }) {
  const { navigateToDraft } = useAbodeSidebar();
  const { draftId: activeDraftId } = useAbodeActiveRoute();
  const composer = useComposerDraftStore((store) => store.draftsByThreadKey[draftId]);
  if (!composer) return null;
  const preview = draftPreview(composer);
  const isActive = activeDraftId === draftId;
  return (
    <li className="list-none">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${preview}, Unsent draft`}
        aria-current={isActive ? "page" : undefined}
        data-testid="sidebar-draft-row"
        onClick={() => navigateToDraft(draftId)}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            navigateToDraft(draftId);
          }
        }}
        data-active={isActive}
        data-abode="row thread"
      >
        <SquarePenIcon aria-hidden className="size-3 shrink-0 text-warning-foreground" />
        <span className="min-w-0 flex-1 truncate">{preview}</span>
        <span data-abode="meta yields">draft</span>
        <button
          type="button"
          aria-label="Discard draft"
          data-abode="action"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            discardComposerDraft(DraftId.make(draftId));
          }}
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </li>
  );
});

/**
 * Unsent drafts that belong to one workspace: an interrupted "new session"
 * stays one click away. Rows are keyed by draft id, so typing in a background
 * draft re-renders only its own row.
 */
export const WorkspaceDrafts = memo(function WorkspaceDrafts(props: {
  readonly memberProjectRefs: ReadonlyArray<ProjectRefLike>;
}) {
  const { draftId: activeDraftId } = useAbodeActiveRoute();
  const refKeys = new Set(props.memberProjectRefs.map(projectRefKey));
  const draftIds = useComposerDraftStore(
    useShallow((store) =>
      visibleDraftRows({
        sessions: store.draftThreadsByThreadKey,
        composers: store.draftsByThreadKey,
        routeDraftId: activeDraftId,
        hasContent: composerDraftHasUserContent,
      })
        .filter(({ session }) => refKeys.has(projectRefKey(session)))
        .map(({ draftId }) => draftId),
    ),
  );
  if (draftIds.length === 0) return null;
  return (
    <>
      {draftIds.map((draftId) => (
        <DraftRow key={draftId} draftId={draftId} />
      ))}
    </>
  );
});
