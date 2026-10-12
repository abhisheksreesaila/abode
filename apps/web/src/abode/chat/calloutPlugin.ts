import { calloutKind, type CardKind } from "./cards";

/**
 * Remark plugin for abode's callouts: lifts `[!QUESTION]`, `[!INFO]`, `[!TICKETS]`,
 * `[!DONE]` and GitHub's own NOTE/TIP/IMPORTANT/WARNING/CAUTION into
 * `data-alert="abode-<kind>"`, so every callout in a chat is drawn as an abode card by
 * upstream's blockquote renderer. It runs after upstream's GitHub-alert plugin and takes
 * over the markers that one leaves in place. A title may follow the marker on its line
 * (`> [!DONE] Shipped`); it becomes a bold first line.
 */

interface MdNode {
  type?: string;
  value?: unknown;
  data?: { hProperties?: Record<string, unknown> };
  children?: MdNode[];
}

const MARKER = /^\[!([A-Za-z]+)\][ \t]*([^\n]*)(?:\r?\n|$)/;

export function abodeAlertValue(kind: CardKind): string {
  return `abode-${kind}`;
}

function readAbodeCallout(node: MdNode): void {
  if (node.type !== "blockquote") return;
  // Already lifted by upstream's GitHub-alert plugin: relabel it as the abode kind.
  const lifted = node.data?.hProperties?.dataAlert;
  if (typeof lifted === "string") {
    const kind = calloutKind(lifted);
    if (kind) node.data!.hProperties!.dataAlert = abodeAlertValue(kind);
    return;
  }
  const paragraph = node.children?.[0];
  const text = paragraph?.children?.[0];
  if (paragraph?.type !== "paragraph" || text?.type !== "text" || typeof text.value !== "string") {
    return;
  }
  const match = MARKER.exec(text.value);
  if (!match) return;
  const tag = match[1]!.toUpperCase();
  const kind = calloutKind(tag);
  if (!kind) return;

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
