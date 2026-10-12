import { describe, expect, it } from "vite-plus/test";

import { remarkAbodeCallouts } from "./calloutPlugin";

const quote = (...children: object[]) => ({
  type: "root",
  children: [{ type: "blockquote", children }],
});
const para = (...values: string[]) => ({
  type: "paragraph",
  children: values.map((value) => ({ type: "text", value })),
});
const run = (tree: ReturnType<typeof quote>) => {
  remarkAbodeCallouts()(tree);
  return tree.children[0] as {
    data?: { hProperties?: Record<string, unknown> };
    children: object[];
  };
};

describe("remarkAbodeCallouts", () => {
  it("marks an abode callout and drops the marker line", () => {
    const node = run(quote(para("[!QUESTION]\nCan I run it now?")));
    expect(node.data?.hProperties?.dataAlert).toBe("abode-question");
    expect(node.children).toEqual([para("Can I run it now?")]);
  });

  it("turns a title on the marker line into a bold first line", () => {
    const node = run(quote(para("[!DONE] Shipped\nSort merged.")));
    expect(node.data?.hProperties?.dataAlert).toBe("abode-done");
    expect(node.children[0]).toEqual({
      type: "paragraph",
      children: [{ type: "strong", children: [{ type: "text", value: "Shipped" }] }],
    });
  });

  it("leaves GitHub's alerts to upstream, as upstream's plugin hands them over", () => {
    // The shape remarkGithubAlerts leaves behind: marker gone, data-alert set.
    const lifted = {
      type: "root",
      children: [
        { type: "blockquote", data: { hProperties: { dataAlert: "note" } }, children: [para("x")] },
      ],
    };
    remarkAbodeCallouts()(lifted);
    expect(lifted.children[0]!.data.hProperties.dataAlert).toBe("note");
    expect(run(quote(para("[!WARNING]\nx"))).data).toBeUndefined();
  });

  it("takes a GitHub tag with a title, which GitHub itself would not render", () => {
    expect(run(quote(para("[!WARNING] Slow query\nx"))).data?.hProperties?.dataAlert).toBe(
      "abode-warning",
    );
  });

  it("leaves plain quotes and unknown markers alone", () => {
    expect(run(quote(para("just a quote"))).data).toBeUndefined();
    expect(run(quote(para("[!BANANA]\nx"))).data).toBeUndefined();
  });

  it("drops a paragraph that only held the marker", () => {
    const node = run(quote(para("[!TICKETS]"), { type: "list", children: [] }));
    expect(node.data?.hProperties?.dataAlert).toBe("abode-tickets");
    expect(node.children).toEqual([{ type: "list", children: [] }]);
  });
});
