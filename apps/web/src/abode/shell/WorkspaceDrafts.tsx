import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import { SquarePenIcon, XIcon } from "lucide-react";
import { memo } from "react";

import {
  DraftId,
  useComposerDraftStore,
  type ComposerThreadDraftState,
} from "~/composerDraftStore";
import { discardComposerDraft } from "~/lib/discardComposerDraft";
import { useAbodeActiveRoute, useAbodeSidebar } from "./sidebarContext";

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
  const isActive = activeDraftId === draftId;
  // The open draft is always "New session": its text is in the composer, and not
  // subscribing keeps its row from repainting on every keystroke.
  const composer = useComposerDraftStore((store) =>
    isActive ? undefined : store.draftsByThreadKey[draftId],
  );
  if (!isActive && !composer) return null;
  const preview = composer ? draftPreview(composer) : "New session";
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
 * Unsent drafts of one workspace. The sidebar works out the ids once for all
 * workspaces; each row subscribes to its own draft, so typing in a background
 * draft re-renders only that row.
 */
export const WorkspaceDrafts = memo(function WorkspaceDrafts(props: {
  readonly draftIds: ReadonlyArray<string>;
}) {
  return (
    <>
      {props.draftIds.map((draftId) => (
        <DraftRow key={draftId} draftId={draftId} />
      ))}
    </>
  );
});
