import { history, undo, undoDepth } from "@tiptap/pm/history";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { describe, expect, it } from "vite-plus/test";

import {
  anchorMarkdownOffset,
  beginProvisionalDictation,
  endProvisionalDictation,
  provisionalTextFor,
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
    beginProvisionalDictation(view, "selection");
    setProvisionalDictation(view, "wor");
    setProvisionalDictation(view, "world peace");
    expect(readProvisionalState(view.state)).toEqual({
      active: true,
      anchor: 6,
      text: "world peace",
    });
    expect(text(view)).toBe("hello");
  });

  it("keeps interim updates out of the undo history", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view, "selection");
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
    beginProvisionalDictation(view, "selection");
    setProvisionalDictation(view, "world");
    view.dispatch(view.state.tr.insertText("Say: ", 1));
    expect(text(view)).toBe("Say: hello");
    expect(readProvisionalState(view.state)).toEqual({ active: true, anchor: 11, text: "world" });
    // Typing after the anchor does not move it.
    view.dispatch(view.state.tr.insertText("!", 11));
    expect(readProvisionalState(view.state).anchor).toBe(11);
    expect(text(view)).toBe("Say: hello!");
  });

  it("keeps text typed exactly at the anchor after the provisional range", () => {
    const view = fakeView("", 0);
    beginProvisionalDictation(view, "selection");
    view.dispatch(view.state.tr.insertText("x", 1));
    expect(readProvisionalState(view.state).anchor).toBe(1);
  });

  it("final text is one undoable step after many interim ticks", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view, "selection");
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
    beginProvisionalDictation(view, "selection");
    setProvisionalDictation(view, "world");
    expect(endProvisionalDictation(view)).toBe(6);
    expect(readProvisionalState(view.state)).toEqual({ active: false, anchor: null, text: "" });
    expect(text(view)).toBe("hello");
    expect(undoDepth(view.state)).toBe(0);
  });

  it("pins at the end of the doc when asked (collapsed phone composer)", () => {
    const view = fakeView("hello", 0);
    beginProvisionalDictation(view, "end");
    expect(readProvisionalState(view.state).anchor).toBe(6);
  });

  it("loses the anchor when the whole doc is replaced mid-dictation and inserts at the caret", () => {
    const view = fakeView("hello", 5);
    beginProvisionalDictation(view, "selection");
    setProvisionalDictation(view, "world");
    const replacement = schema.node("paragraph", null, [schema.text("recalled draft")]);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, replacement));
    expect(readProvisionalState(view.state)).toMatchObject({ active: true, anchor: null });
    expect(endProvisionalDictation(view)).toBeNull();
    expect(readProvisionalState(view.state).active).toBe(false);
  });

  it("is its own undo step when the final text replaces the whole doc, as the composer does", () => {
    const view = fakeView("hello", 5);
    view.dispatch(view.state.tr.insertText("!", 6));
    beginProvisionalDictation(view, "selection");
    for (const interim of ["w", "world"]) setProvisionalDictation(view, interim);
    endProvisionalDictation(view);
    const next = schema.node("paragraph", null, [schema.text("hello! world")]);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, next));
    expect(undoDepth(view.state)).toBe(2);
    undo(view.state, view.dispatch);
    expect(text(view)).toBe("hello!");
  });
});

describe("provisionalTextFor", () => {
  it("shows only heard words, never download progress", () => {
    expect(provisionalTextFor({ status: "recording" })).toBe("");
    expect(provisionalTextFor({ status: "recording", downloadProgress: 0.4 })).toBe("");
    expect(provisionalTextFor({ status: "recording", interim: "…hello there" })).toBe(
      "…hello there",
    );
  });

  it("leaves the heard words in place while transcribing and clears otherwise", () => {
    expect(provisionalTextFor({ status: "transcribing", downloadProgress: 0.4 })).toBeUndefined();
    expect(provisionalTextFor({ status: "idle" })).toBeNull();
    expect(provisionalTextFor({ status: "error", message: "x" })).toBeNull();
  });
});
