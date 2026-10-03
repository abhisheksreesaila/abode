import { history, undo, undoDepth } from "@tiptap/pm/history";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { describe, expect, it } from "vite-plus/test";

import {
  beginProvisionalDictation,
  endProvisionalDictation,
  provisionalPlugin,
  readProvisionalState,
  setProvisionalDictation,
} from "./provisionalDictation";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", toDOM: () => ["p", 0] },
    text: {},
  },
});

/** The helpers only need `state` and `dispatch`; this is enough of a view to run them headless. */
function fakeView(text: string, caret: number) {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, text ? [schema.text(text)] : []),
  ]);
  const created = EditorState.create({ doc, plugins: [history(), provisionalPlugin] });
  const view = {
    // Positions inside the first paragraph are 1-based.
    state: created.apply(created.tr.setSelection(TextSelection.create(doc, caret + 1))),
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
  };
  return view as typeof view & EditorView;
}

const text = (view: { state: EditorState }) => view.state.doc.textContent;

describe("provisional dictation", () => {
  it("pins the insertion point at the selection and never writes into the doc", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view);
    setProvisionalDictation(view, "wor");
    setProvisionalDictation(view, "world peace");
    expect(readProvisionalState(view.state)).toEqual({ anchor: 6, text: "world peace" });
    expect(text(view)).toBe("hello");
  });

  it("keeps interim updates out of the undo history", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view);
    for (const interim of ["a", "ab", "abc"]) setProvisionalDictation(view, interim);
    expect(undoDepth(view.state)).toBe(0);
  });

  it("does nothing when no dictation is active", () => {
    const view = fakeView("hello", 5);
    setProvisionalDictation(view, "ignored");
    expect(readProvisionalState(view.state).anchor).toBeNull();
    expect(endProvisionalDictation(view)).toBeNull();
  });

  it("tracks the anchor through typing before it and leaves typed text untouched", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view);
    setProvisionalDictation(view, "world");
    view.dispatch(view.state.tr.insertText("Say: ", 1));
    expect(text(view)).toBe("Say: hello");
    expect(readProvisionalState(view.state)).toEqual({ anchor: 11, text: "world" });
    // Typing after the anchor does not move it.
    view.dispatch(view.state.tr.insertText("!", 11));
    expect(readProvisionalState(view.state).anchor).toBe(11);
    expect(text(view)).toBe("Say: hello!");
  });

  it("keeps text typed exactly at the anchor after the provisional range", () => {
    const view = fakeView("", 0);
    beginProvisionalDictation(view);
    view.dispatch(view.state.tr.insertText("x", 1));
    expect(readProvisionalState(view.state).anchor).toBe(1);
  });

  it("final text is one undoable step after many interim ticks", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view);
    for (const interim of ["w", "wor", "world"]) setProvisionalDictation(view, interim);
    const anchor = endProvisionalDictation(view)!;
    view.dispatch(view.state.tr.insertText(" world.", anchor));
    expect(text(view)).toBe("hello world.");
    expect(undoDepth(view.state)).toBe(1);
    undo(view.state, view.dispatch);
    expect(text(view)).toBe("hello");
  });

  it("cancel removes the range, leaves the doc alone, and adds no history", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view);
    setProvisionalDictation(view, "world");
    expect(endProvisionalDictation(view)).toBe(6);
    expect(readProvisionalState(view.state)).toEqual({ anchor: null, text: "" });
    expect(text(view)).toBe("hello");
    expect(undoDepth(view.state)).toBe(0);
  });
});
