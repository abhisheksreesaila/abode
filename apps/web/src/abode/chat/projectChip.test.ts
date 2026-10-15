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

  it("reads WSL network paths as the Linux home", () => {
    expect(projectParentLabel("\\\\wsl.localhost\\Ubuntu\\home\\me\\x")).toBe("~");
    expect(projectParentLabel("\\\\wsl$\\Ubuntu\\home\\me\\code\\x")).toBe("~/code");
  });

  it("matches Windows home folders in any case", () => {
    expect(projectParentLabel("c:\\users\\me\\code\\x")).toBe("~/code");
  });

  it("shows nothing for a project that is the home folder itself", () => {
    expect(projectParentLabel("/home/me")).toBe("");
  });

  it("is empty for an empty root", () => {
    expect(projectParentLabel("")).toBe("");
  });
});
