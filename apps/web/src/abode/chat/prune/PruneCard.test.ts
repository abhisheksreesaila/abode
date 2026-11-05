import { createElement } from "react";
import { describe, expect, it } from "vite-plus/test";

import { codeText } from "./PruneCard";

describe("codeText", () => {
  it("reads the fenced text out of the code element, without the trailing newline", () => {
    expect(
      codeText(createElement("code", { className: "language-abode-prune" }, "a | b | 1\n")),
    ).toBe("a | b | 1");
    expect(codeText("nothing")).toBe("");
  });
});
