import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/**
 * Live dictation text shown in the composer while the user is still speaking.
 *
 * The provisional text is a widget decoration pinned to a mapped document position, not document
 * content. That is deliberate: it can never enter the undo history, the draft, or a sent message,
 * and edits elsewhere in the editor cannot disturb it (the anchor just maps through them). The
 * final transcript is the only thing that becomes real text.
 */
export interface ProvisionalDictationState {
  /** Where the dictation will land; null when no dictation is in flight. */
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

const IDLE: ProvisionalDictationState = { anchor: null, text: "" };

export function applyProvisionalMeta(
  state: ProvisionalDictationState,
  tr: Pick<Transaction, "docChanged" | "mapping" | "getMeta">,
): ProvisionalDictationState {
  const meta = tr.getMeta(provisionalDictationKey) as ProvisionalMeta | undefined;
  if (meta?.type === "begin") return { anchor: meta.anchor, text: "" };
  if (meta?.type === "end") return IDLE;
  if (state.anchor === null) return state;
  // assoc -1: text typed exactly at the anchor lands after it, so the range never swallows typing.
  const anchor = tr.docChanged ? tr.mapping.map(state.anchor, -1) : state.anchor;
  if (meta?.type === "set") return { anchor, text: meta.text };
  return anchor === state.anchor ? state : { anchor, text: state.text };
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
  view.dispatch(
    view.state.tr.setMeta(provisionalDictationKey, meta).setMeta("addToHistory", false),
  );
}

export function readProvisionalState(state: EditorState): ProvisionalDictationState {
  return provisionalDictationKey.getState(state) ?? IDLE;
}

/** Remembers the insertion point: where the selection starts when recording begins. */
export function beginProvisionalDictation(view: EditorView): void {
  dispatchMeta(view, { type: "begin", anchor: view.state.selection.from });
}

/** Replaces the single provisional range with `text`. A no-op unless a dictation is active. */
export function setProvisionalDictation(view: EditorView, text: string): void {
  const current = readProvisionalState(view.state);
  if (current.anchor === null || current.text === text) return;
  dispatchMeta(view, { type: "set", text });
}

/** Removes the provisional range and returns where it was (null when none was active). */
export function endProvisionalDictation(view: EditorView): number | null {
  const { anchor } = readProvisionalState(view.state);
  if (anchor === null) return null;
  dispatchMeta(view, { type: "end" });
  return anchor;
}
