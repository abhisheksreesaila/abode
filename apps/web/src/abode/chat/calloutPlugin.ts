import { calloutKind, type CardKind } from "./cards";

/**
 * Lifts abode's callouts (`[!QUESTION]`, `[!DONE]`, …) into `data-alert="abode-<kind>"`
 * like upstream's GitHub-alert plugin, so upstream's blockquote renderer draws them and
 * GitHub's five stay upstream's. A title after the marker (`> [!DONE] Shipped`) becomes
 * a bold first line.
 */

interface MdNode {
  type?: string;
  value?: unknown;
  data?: { hProperties?: Record<string, unknown> };
  children?: MdNode[];
}

const GITHUB_TAGS = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
const MARKER = /^\[!([A-Za-z]+)\][ \t]*([^\n]*)(?:\r?\n|$)/;

export function abodeAlertValue(kind: CardKind): string {
  return `abode-${kind}`;
}

function readAbodeCallout(node: MdNode): void {
  if (node.type !== "blockquote") return;
  // Already lifted by upstream's GitHub-alert plugin: that one stays upstream's.
  if (node.data?.hProperties?.dataAlert !== undefined) return;
  const paragraph = node.children?.[0];
  const text = paragraph?.children?.[0];
  if (paragraph?.type !== "paragraph" || text?.type !== "text" || typeof text.value !== "string") {
    return;
  }
  const match = MARKER.exec(text.value);
  if (!match) return;
  const tag = match[1]!.toUpperCase();
  const kind = calloutKind(tag);
  // A bare GitHub marker is upstream's; with a title it is abode syntax (GitHub ignores it).
  if (!kind || (GITHUB_TAGS.has(tag) && match[2] === "")) return;

  const title = match[2]!.trim();
  const remainder = text.value.slice(match[0].length);
  if (remainder.length > 0) text.value = remainder;
  else paragraph.children!.shift();
  if (paragraph.children!.length === 0) node.children!.shift();
  if (title) {
    node.children!.unshift({
      type: "paragraph",
      children: [{ type: "strong", children: [{ type: "text", value: title }] }],
    });
  }
  node.data = {
    ...node.data,
    hProperties: { ...node.data?.hProperties, dataAlert: abodeAlertValue(kind) },
  };
}

export function remarkAbodeCallouts() {
  return (tree: MdNode) => {
    const visit = (node: MdNode) => {
      node.children?.forEach(visit);
      readAbodeCallout(node);
    };
    visit(tree);
  };
}
