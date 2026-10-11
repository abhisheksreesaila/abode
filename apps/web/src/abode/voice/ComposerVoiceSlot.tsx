import type { RefObject } from "react";

import type { ComposerPromptEditorHandle } from "../../components/ComposerPromptEditorTiptap";
import { ComposerVoiceControl } from "./ComposerVoiceControl";

/**
 * The single piece of voice UI that ChatComposer renders: the mic control wired to the
 * composer's editor handle. All dictation behavior lives in this folder.
 */
export function ComposerVoiceSlot({
  editorRef,
  insertText,
  disabled,
  resetKey,
  collapsedMobile,
  expandMobile,
}: {
  editorRef: RefObject<ComposerPromptEditorHandle | null>;
  /** Inserts at a markdown offset (or the caret); false when the composer cannot take text. */
  insertText: (text: string, anchor: number | "cursor") => boolean;
  disabled: boolean;
  /** Changes when the composer moves to another draft; an active dictation is cancelled. */
  resetKey: string;
  /** The phone composer is collapsed, so its editor is hidden and has no meaningful caret. */
  collapsedMobile: boolean;
  expandMobile: () => void;
}) {
  return (
    <ComposerVoiceControl
      disabled={disabled}
      resetKey={resetKey}
      onProvisionalStart={() => {
        if (collapsedMobile) expandMobile();
        editorRef.current?.provisionalDictation.begin(collapsedMobile ? "end" : "selection");
      }}
      onProvisionalText={(text) => editorRef.current?.provisionalDictation.update(text)}
      onProvisionalEnd={() => {
        editorRef.current?.provisionalDictation.end();
      }}
      onTranscript={(text) => {
        // The final text replaces the provisional range where it was pinned, as one edit.
        const anchor = editorRef.current?.provisionalDictation.end() ?? null;
        return insertText(text, anchor ?? "cursor");
      }}
    />
  );
}
