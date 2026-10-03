import { describe, expect, it } from "vite-plus/test";

import { resolveComposerOuterRows } from "./composerOuterRows";

const expanded = {
  showWorkspaceRow: true,
  controlsInStrip: false,
  isCollapsedMobile: false,
  isApprovalState: false,
  hasTopHost: true,
  hasBottomHost: true,
} as const;

describe("resolveComposerOuterRows", () => {
  it("shows both rows around an expanded draft composer", () => {
    expect(resolveComposerOuterRows(expanded)).toEqual({
      topRow: true,
      statusRow: true,
      statusRowOwnsControls: true,
    });
  });

  it("leaves the picker row off a started thread", () => {
    expect(resolveComposerOuterRows({ ...expanded, showWorkspaceRow: false }).topRow).toBe(false);
  });

  it("hides the picker row while the phone composer is collapsed", () => {
    expect(
      resolveComposerOuterRows({ ...expanded, controlsInStrip: true, isCollapsedMobile: true }),
    ).toEqual({ topRow: false, statusRow: false, statusRowOwnsControls: false });
  });

  it("keeps the controls in the strip while resting", () => {
    expect(resolveComposerOuterRows({ ...expanded, controlsInStrip: true })).toEqual({
      topRow: true,
      statusRow: false,
      statusRowOwnsControls: false,
    });
  });

  it("hides the status row during an approval without handing the controls back", () => {
    expect(resolveComposerOuterRows({ ...expanded, isApprovalState: true })).toEqual({
      topRow: true,
      statusRow: false,
      statusRowOwnsControls: true,
    });
  });

  it("falls back to the footer until the hosts exist", () => {
    expect(
      resolveComposerOuterRows({ ...expanded, hasTopHost: false, hasBottomHost: false }),
    ).toEqual({ topRow: false, statusRow: false, statusRowOwnsControls: false });
  });
});
