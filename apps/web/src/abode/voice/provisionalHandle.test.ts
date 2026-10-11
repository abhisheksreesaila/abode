import { describe, expect, it, vi } from "vite-plus/test";

import { createProvisionalDictationHandle } from "./provisionalDictation";

describe("createProvisionalDictationHandle", () => {
  it("is inert when the editor is not mounted, and end() still clears the placeholder flag", () => {
    const onActiveChange = vi.fn();
    const handle = createProvisionalDictationHandle(null, onActiveChange);
    handle.begin("selection");
    handle.update("hello");
    expect(handle.end()).toBeNull();
    expect(onActiveChange.mock.calls).toEqual([[false]]);
  });
});
