import { describe, expect, it } from "vite-plus/test";

import {
  modelPickerNeedsComposerExpanded,
  resolveModelPickerPlacement,
  shouldShowWorkspaceRow,
} from "./composerPickerPlacement";

const draft = {
  routeKind: "draft",
  hasDraftId: true,
  isCollapsedMobile: false,
  providerUnavailable: false,
} as const;

describe("resolveModelPickerPlacement", () => {
  it("puts the picker in the top row on a draft", () => {
    expect(resolveModelPickerPlacement(draft)).toBe("top-row");
  });

  it("keeps it in the footer for a server thread", () => {
    expect(resolveModelPickerPlacement({ ...draft, routeKind: "server" })).toBe("footer");
  });

  it("keeps it in the strip on a collapsed phone composer or without a provider", () => {
    expect(resolveModelPickerPlacement({ ...draft, isCollapsedMobile: true })).toBe("footer");
    expect(resolveModelPickerPlacement({ ...draft, providerUnavailable: true })).toBe("footer");
  });
});

describe("modelPickerNeedsComposerExpanded", () => {
  it("opens straight from the keybinding when the picker is in the top row", () => {
    expect(
      modelPickerNeedsComposerExpanded({ placement: "top-row", stripControlsHidden: true }),
    ).toBe(false);
  });

  it("expands the composer first when the strip holding the picker is hidden", () => {
    expect(
      modelPickerNeedsComposerExpanded({ placement: "footer", stripControlsHidden: true }),
    ).toBe(true);
    expect(
      modelPickerNeedsComposerExpanded({ placement: "footer", stripControlsHidden: false }),
    ).toBe(false);
  });
});

describe("shouldShowWorkspaceRow", () => {
  it("shows the workspace chip on every draft, including when the provider is unavailable", () => {
    expect(shouldShowWorkspaceRow({ routeKind: "draft", hasDraftId: true })).toBe(true);
    expect(resolveModelPickerPlacement({ ...draft, providerUnavailable: true })).toBe("footer");
  });

  it("does not show it on a started thread", () => {
    expect(shouldShowWorkspaceRow({ routeKind: "server", hasDraftId: false })).toBe(false);
  });
});
