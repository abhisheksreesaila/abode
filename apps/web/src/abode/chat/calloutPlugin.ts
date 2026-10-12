import { calloutKind, type CardKind } from "./cards";

/**
 * Remark plugin for abode's callouts. Upstream's GitHub-alert plugin handles NOTE, TIP,
 * IMPORTANT, WARNING and CAUTION; this one lifts abode's own markers (`[!QUESTION]`,
 * `[!INFO]`, `[!TICKETS]`, `[!DONE]`, …) into `data-alert="abode-<kind>"` the same way, so
 * upstream's blockquote renderer can draw them. Unlike GitHub, a title may follow the
 * marker on its line (`> [!DONE] Shipped`); it becomes a bold first line.
 */

interface MdNode {
  type?: string;
  value?: unknown;
  data?: { hProperties?: Record<string, unknown> };
  children?: MdNode[];
}

const GITHUB_KINDS = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
const MARKER = /^\[!([A-Za-z]+)\][ \t]*([^\n]*)(?:\r?\n|$)/;

export function abodeAlertValue(kind: CardKind): string {
  return `abode-${kind}`;
}

function readAbodeCallout(node: MdNode): void {
  if (node.type !== "blockquote") return;
  const paragraph = node.children?.[0];
  const text = paragraph?.children?.[0];
  if (paragraph?.type !== "paragraph" || text?.type !== "text" || typeof text.value !== "string") {
    return;
  }
  const match = MARKER.exec(text.value);
  if (!match) return;
  const tag = match[1]!.toUpperCase();
  const kind = calloutKind(tag);
  // GitHub's own alerts stay upstream's, unless a title makes them abode-only syntax.
  if (!kind || (GITHUB_KINDS.has(tag) && match[2] === "")) return;

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
