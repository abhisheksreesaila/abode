import { describe, expect, it } from "vite-plus/test";

import { PROVIDER_TINT_CLASS_NAMES, resolveProviderTint } from "./providerTint";

describe("resolveProviderTint", () => {
  it("tints Claude and Codex and leaves other providers neutral", () => {
    expect(resolveProviderTint("claudeAgent")).toBe("claude");
    expect(resolveProviderTint("codex")).toBe("codex");
    expect(resolveProviderTint("cursor")).toBe("none");
    expect(resolveProviderTint("opencode")).toBe("none");
    expect(resolveProviderTint(undefined)).toBe("none");
  });

  it("uses Claude orange at 12% for the Claude background", () => {
    expect(PROVIDER_TINT_CLASS_NAMES.claude).toContain("bg-[#d97757]/12");
    expect(PROVIDER_TINT_CLASS_NAMES.none).toBe("");
  });
});
