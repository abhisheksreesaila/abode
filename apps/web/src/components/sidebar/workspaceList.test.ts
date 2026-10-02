import { describe, expect, it } from "vite-plus/test";

import {
  formatWorkspaceLocation,
  threadListWindow,
  homeRelativePath,
  resolveWorkspacePill,
  splitLatestThreads,
  workspaceInitials,
} from "./workspaceList";

describe("workspaceInitials", () => {
  it("takes two letters from a single word", () => {
    expect(workspaceInitials("finxplorer")).toBe("FI");
  });
  it("takes the first letter of the first two words", () => {
    expect(workspaceInitials("travel-os")).toBe("TO");
    expect(workspaceInitials("My great app")).toBe("MG");
  });
  it("handles one-letter and empty names", () => {
    expect(workspaceInitials("x")).toBe("X");
    expect(workspaceInitials("  ")).toBe("?");
  });
});

describe("homeRelativePath", () => {
  it("shortens Linux, macOS and Windows home folders", () => {
    expect(homeRelativePath("/home/me/Projects/x")).toBe("~/Projects/x");
    expect(homeRelativePath("/Users/me/code")).toBe("~/code");
    expect(homeRelativePath("C:\\Users\\me\\code\\x")).toBe("~/code/x");
    expect(homeRelativePath("/home/me")).toBe("~");
  });
  it("leaves other paths alone", () => {
    expect(homeRelativePath("/srv/app")).toBe("/srv/app");
    expect(homeRelativePath("/homework/x")).toBe("/homework/x");
  });
});

describe("formatWorkspaceLocation", () => {
  const base = { workspaceRoot: "/home/me/code/travel-os", remoteEnvironmentLabels: ["mac-mini"] };
  it("is just the path for the local environment", () => {
    expect(formatWorkspaceLocation({ ...base, isRemoteOnly: false })).toBe("~/code/travel-os");
  });
  it("leads with the machine for a remote environment", () => {
    expect(formatWorkspaceLocation({ ...base, isRemoteOnly: true })).toBe(
      "mac-mini · ~/code/travel-os",
    );
  });
  it("falls back to the path when the remote has no label", () => {
    expect(
      formatWorkspaceLocation({ ...base, remoteEnvironmentLabels: [], isRemoteOnly: true }),
    ).toBe("~/code/travel-os");
  });
});

describe("resolveWorkspacePill", () => {
  const t = (statusLabel: string | null, failed = false) => ({
    statusLabel,
    failedUnseen: failed,
  });
  it("is null when nothing is happening", () => {
    expect(resolveWorkspacePill([t(null), t(null)])).toBeNull();
  });
  it("counts Monitoring as running", () => {
    expect(resolveWorkspacePill([t("Monitoring"), t("Working")])).toMatchObject({
      kind: "running",
      count: 2,
    });
  });
  it("shows a done pill for unseen completions, below everything else", () => {
    expect(resolveWorkspacePill([t("Completed")])).toMatchObject({ kind: "done", label: "done" });
    expect(resolveWorkspacePill([t("Completed"), t("Working")])?.kind).toBe("running");
  });
  it("counts running threads", () => {
    expect(resolveWorkspacePill([t("Working"), t("Connecting"), t(null)])).toMatchObject({
      kind: "running",
      count: 2,
      label: "2 running",
    });
  });
  it("ranks needs-you over failed over running, listing all in the detail", () => {
    const pill = resolveWorkspacePill([t("Working"), t(null, true), t("Awaiting Input")]);
    expect(pill).toMatchObject({ kind: "needs-you", label: "1 needs you" });
    expect(pill?.detail).toBe("1 needs you, failed, 1 running");
    expect(resolveWorkspacePill([t("Working"), t(null, true)])?.label).toBe("failed");
  });
});

describe("splitLatestThreads", () => {
  it("shows everything when there are two or fewer", () => {
    expect(splitLatestThreads([1, 2])).toEqual({ shown: [1, 2], olderCount: 0 });
  });
  it("shows the latest two and counts the rest", () => {
    expect(splitLatestThreads([1, 2, 3, 4, 5])).toEqual({ shown: [1, 2], olderCount: 3 });
  });
  it("keeps the active thread visible", () => {
    expect(splitLatestThreads([1, 2, 3, 4, 5], { isActive: (n) => n === 4 })).toEqual({
      shown: [1, 2, 4],
      olderCount: 2,
    });
  });
});

describe("threadListWindow", () => {
  it("offers nothing extra for two or fewer threads", () => {
    expect(threadListWindow([1, 2], { expanded: false })).toEqual({
      shown: [1, 2],
      olderCount: 0,
      showMore: false,
      showLess: false,
    });
  });
  it("offers +N older when collapsed, and Show less when expanded", () => {
    expect(threadListWindow([1, 2, 3, 4], { expanded: false })).toMatchObject({
      shown: [1, 2],
      olderCount: 2,
      showMore: true,
      showLess: false,
    });
    expect(threadListWindow([1, 2, 3, 4], { expanded: true })).toMatchObject({
      shown: [1, 2, 3, 4],
      showMore: false,
      showLess: true,
    });
  });
  it("never offers +0 older when the active thread is the only hidden one", () => {
    const window = threadListWindow([1, 2, 3], { expanded: false, isActive: (n) => n === 3 });
    expect(window).toMatchObject({ shown: [1, 2, 3], olderCount: 0, showMore: false });
  });
});
