import { describe, expect, it } from "vite-plus/test";

import {
  CHIP_TINT_CLASS_NAMES,
  resolveBranchTint,
  resolveRuntimeModeTint,
  resolveWorkspaceTint,
} from "./chipTint";

describe("resolveRuntimeModeTint", () => {
  it("maps risk to red, amber and green", () => {
    expect(resolveRuntimeModeTint("full-access")).toBe("danger");
    expect(resolveRuntimeModeTint("auto-accept-edits")).toBe("caution");
    expect(resolveRuntimeModeTint("approval-required")).toBe("safe");
    expect(resolveRuntimeModeTint("auto")).toBe("none");
  });
});

describe("resolveBranchTint", () => {
  it("is purple for main, master and trunk and blue for other branches", () => {
    expect(resolveBranchTint("main")).toBe("branch-main");
    expect(resolveBranchTint("master")).toBe("branch-main");
    expect(resolveBranchTint("Trunk")).toBe("branch-main");
    expect(resolveBranchTint("feature/booking")).toBe("branch-feature");
    expect(resolveBranchTint("main-fix")).toBe("branch-feature");
  });

  it("is blue for every branch in the brand (abode) theme", () => {
    expect(resolveBranchTint("main", { brand: true })).toBe("branch-feature");
    expect(resolveBranchTint("feature/x", { brand: true })).toBe("branch-feature");
    expect(resolveBranchTint(null, { brand: true })).toBe("none");
  });

  it("is untinted without a branch", () => {
    expect(resolveBranchTint(null)).toBe("none");
    expect(resolveBranchTint("  ")).toBe("none");
  });
});

describe("resolveWorkspaceTint", () => {
  it("tints worktrees teal", () => {
    expect(resolveWorkspaceTint(true)).toBe("worktree");
    expect(resolveWorkspaceTint(false)).toBe("none");
  });
});

describe("CHIP_TINT_CLASS_NAMES", () => {
  it("gives every tint a class string except none", () => {
    for (const [tint, classes] of Object.entries(CHIP_TINT_CLASS_NAMES)) {
      expect(classes === "").toBe(tint === "none");
    }
  });

  it("keeps provider chips neutral with a brand dot", () => {
    expect(CHIP_TINT_CLASS_NAMES.claude).toContain("--chip-claude");
    expect(CHIP_TINT_CLASS_NAMES.claude).not.toContain("bg-[color-mix");
  });

  it("makes Full access the only semibold tint", () => {
    expect(CHIP_TINT_CLASS_NAMES.danger).toContain("font-semibold");
    expect(CHIP_TINT_CLASS_NAMES.caution).not.toContain("font-semibold");
  });
});
