import { describe, expect, it } from "vite-plus/test";

import { projectParentLabel } from "./projectChip";

describe("projectParentLabel", () => {
  it("is the parent folder, home-relative, like VS Code's picker", () => {
    expect(projectParentLabel("/home/me/Projects/travelos")).toBe("~/Projects");
    expect(projectParentLabel("/Users/me/Projects/multi-agent/firstmate")).toBe(
      "~/Projects/multi-agent",
    );
    expect(projectParentLabel("/home/me/.pi/agent")).toBe("~/.pi");
  });

  it("is ~ for a project straight in the home folder", () => {
    expect(projectParentLabel("/home/me/notes")).toBe("~");
  });

  it("handles Windows paths and trailing separators", () => {
    expect(projectParentLabel("C:\\Users\\me\\code\\x\\")).toBe("~/code");
  });

  it("leaves paths outside a home folder as they are", () => {
    expect(projectParentLabel("/srv/apps/site")).toBe("/srv/apps");
    expect(projectParentLabel("/srv")).toBe("/");
  });

  it("is empty for an empty root", () => {
    expect(projectParentLabel("")).toBe("");
  });
});
