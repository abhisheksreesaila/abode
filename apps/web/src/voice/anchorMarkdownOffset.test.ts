import { getSchemaByResolvedExtensions, Node, resolveExtensions } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vite-plus/test";

import { buildDocJson } from "../composer-rich-text-doc";
import { anchorMarkdownOffset } from "./provisionalDictation";

const mention = Node.create({
  name: "composer-mention",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({ path: { default: "" }, source: { default: "" } }),
});

const schema = getSchemaByResolvedExtensions(
  resolveExtensions([
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      listItem: false,
      orderedList: false,
      dropcursor: false,
      gapcursor: false,
      trailingNode: false,
      code: false,
    }),
    mention,
  ]),
);

function docFor(markdown: string) {
  const doc = ProseMirrorNode.fromJSON(
    schema,
    buildDocJson(markdown, (name) => ({ label: name, description: null })),
  );
  doc.check();
  return doc;
}

describe("anchorMarkdownOffset", () => {
  it("counts a mention token and bold markers before the anchor in markdown, not doc, units", () => {
    const markdown = "@src/a.ts **bold** end";
    const doc = docFor(markdown);
    // Doc end sits after "end"; the markdown offset must include the ** markers and the path.
    expect(anchorMarkdownOffset(doc, doc.content.size - 1)).toBe(markdown.length);
  });

  it("maps an anchor in the middle of the text", () => {
    const markdown = "@src/a.ts **bold** end";
    const doc = docFor(markdown);
    let anchor = -1;
    doc.descendants((node, pos) => {
      if (node.isText && node.text === " end") anchor = pos;
    });
    expect(anchor).toBeGreaterThan(0);
    expect(anchorMarkdownOffset(doc, anchor)).toBe(markdown.indexOf(" end"));
  });
});
