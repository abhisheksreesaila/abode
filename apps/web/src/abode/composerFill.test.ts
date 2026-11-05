import { describe, expect, it } from "vite-plus/test";

import { fillOrAppend } from "./composerFill";

describe("fillOrAppend", () => {
  it("fills an empty or blank composer", () => {
    expect(fillOrAppend("", "Plan it")).toBe("Plan it");
    expect(fillOrAppend("  \n", "Plan it")).toBe("Plan it");
  });
  it("keeps a half-typed draft and adds the text on a new line", () => {
    expect(fillOrAppend("fix the login ", "Plan it")).toBe("fix the login\nPlan it");
  });
});
