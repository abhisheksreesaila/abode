import { describe, expect, it } from "vite-plus/test";

import { resolveProviderTint } from "./providerTint";

describe("resolveProviderTint", () => {
  it("marks Claude and Codex and leaves other providers plain", () => {
    expect(resolveProviderTint("claudeAgent")).toBe("claude");
    expect(resolveProviderTint("codex")).toBe("codex");
    expect(resolveProviderTint("cursor")).toBe("none");
    expect(resolveProviderTint("opencode")).toBe("none");
    expect(resolveProviderTint(undefined)).toBe("none");
  });
});
