import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, Selection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { flatToMarkdown, pmToFlat, serializeEditorDoc } from "../composer-rich-text-doc";
import type { RecordingState } from "./recordingMachine";

/**
 * Live dictation text shown in the composer while the user is still speaking.
 *
 * The provisional text is a widget decoration pinned to a mapped document position, not document
 * content. That is deliberate: it can never enter the undo history, the draft, or a sent message,
 * and edits elsewhere in the editor cannot disturb it (the anchor just maps through them). The
 * final transcript is the only thing that becomes real text.
 */
export interface ProvisionalDictationState {
  /** A dictation is in flight (the anchor may still have been lost to a rewrite of the doc). */
  active: boolean;
  /** Where the dictation will land; null when idle or when the text around it was deleted. */
  anchor: number | null;
  /** Muted text shown at the anchor ("" renders nothing but keeps the anchor). */
  text: string;
}

export const provisionalDictationKey = new PluginKey<ProvisionalDictationState>(
  "voice-provisional-dictation",
);

type ProvisionalMeta =
  | { type: "begin"; anchor: number }
  | { type: "set"; text: string }
  | { type: "end" };

const IDLE: ProvisionalDictationState = { active: false, anchor: null, text: "" };

export function applyProvisionalMeta(
  state: ProvisionalDictationState,
  tr: Pick<Transaction, "docChanged" | "mapping" | "getMeta">,
): ProvisionalDictationState {
  const meta = tr.getMeta(provisionalDictationKey) as ProvisionalMeta | undefined;
  if (meta?.type === "begin") return { active: true, anchor: meta.anchor, text: "" };
  if (meta?.type === "end") return IDLE;
  if (!state.active) return state;
  let anchor = state.anchor;
  if (anchor !== null && tr.docChanged) {
    // assoc -1: text typed exactly at the anchor lands after it, so the range never swallows
    // typing. If the surrounding text was replaced wholesale the anchor is lost: the final text
    // then goes to the caret instead of a stale position.
    const mapped = tr.mapping.mapResult(anchor, -1);
    anchor = mapped.deleted ? null : mapped.pos;
  }
  const text = meta?.type === "set" ? meta.text : state.text;
  return anchor === state.anchor && text === state.text ? state : { ...state, anchor, text };
}

function provisionalWidget(text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "composer-voice-provisional";
  element.setAttribute("data-voice-provisional", "true");
  element.setAttribute("aria-hidden", "true");
  element.textContent = text;
  return element;
}

export const provisionalPlugin = new Plugin<ProvisionalDictationState>({
  key: provisionalDictationKey,
  state: {
    init: () => IDLE,
    apply: (tr, value) => applyProvisionalMeta(value, tr),
  },
  props: {
    decorations(state) {
      const current = provisionalDictationKey.getState(state);
      if (!current || current.anchor === null || current.text.length === 0) return null;
      const anchor = Math.min(current.anchor, state.doc.content.size);
      return DecorationSet.create(state.doc, [
        Decoration.widget(anchor, () => provisionalWidget(current.text), {
          side: -1,
          key: `voice-provisional:${current.text}`,
        }),
      ]);
    },
  },
});

export const ComposerVoiceProvisionalExtension = Extension.create({
  name: "composer-voice-provisional",
  addProseMirrorPlugins() {
    return [provisionalPlugin];
  },
});

function dispatchMeta(view: EditorView, meta: ProvisionalMeta): void {
  // Meta-only: no doc change (so no onUpdate, no serialization) and kept out of undo history.
  const tr = view.state.tr.setMeta(provisionalDictationKey, meta).setMeta("addToHistory", false);
  // Ending closes the history group so the dictation that follows is its own undo step.
  view.dispatch(meta.type === "end" ? closeHistory(tr) : tr);
}

export function readProvisionalState(state: EditorState): ProvisionalDictationState {
  return provisionalDictationKey.getState(state) ?? IDLE;
}

/**
 * Remembers the insertion point. "selection" is where the caret is; "end" is the end of the
 * document, for a collapsed phone composer whose editor holds no meaningful caret.
 */
export function beginProvisionalDictation(view: EditorView, at: "selection" | "end"): void {
  const anchor = at === "end" ? Selection.atEnd(view.state.doc).from : view.state.selection.from;
  dispatchMeta(view, { type: "begin", anchor });
}

/** Replaces the single provisional range with `text`. A no-op unless a dictation is active. */
export function setProvisionalDictation(view: EditorView, text: string): void {
  const current = readProvisionalState(view.state);
  if (!current.active || current.text === text) return;
  dispatchMeta(view, { type: "set", text });
}

/**
 * Removes the provisional range. Returns where it was (a document position), or null when none
 * was active or the anchor was lost; null tells the caller to insert at the caret.
 */
export function endProvisionalDictation(view: EditorView): number | null {
  const { active, anchor } = readProvisionalState(view.state);
  if (!active) return null;
  dispatchMeta(view, { type: "end" });
  return anchor;
}

/** The markdown offset of a document position, which is what the prompt string is indexed by. */
export function anchorMarkdownOffset(doc: ProseMirrorNode, anchor: number): number {
  const map = serializeEditorDoc(doc);
  return Math.max(0, Math.min(map.value.length, flatToMarkdown(map, pmToFlat(map, anchor))));
}

/** Only heard words go into the composer; `undefined` leaves the current text in place. */
export function provisionalTextFor(state: RecordingState): string | null | undefined {
  switch (state.status) {
    case "recording":
      return state.interim ?? "";
    case "transcribing":
      return undefined;
    default:
      return null;
  }
}
