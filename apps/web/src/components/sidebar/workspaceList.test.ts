import { describe, expect, it } from "vite-plus/test";

import {
  formatWorkspaceLocation,
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
  const t = (statusLabel: string | null, sessionStatus: string | null = null) => ({
    statusLabel,
    sessionStatus,
  });
  it("is null when nothing is happening", () => {
    expect(resolveWorkspacePill([t(null), t("Completed")])).toBeNull();
  });
  it("counts running threads", () => {
    expect(resolveWorkspacePill([t("Working"), t("Connecting"), t(null)])).toMatchObject({
      kind: "running",
      count: 2,
      label: "2 running",
    });
  });
  it("ranks needs-you over failed over running, listing all in the detail", () => {
    const pill = resolveWorkspacePill([t("Working"), t(null, "error"), t("Awaiting Input")]);
    expect(pill).toMatchObject({ kind: "needs-you", label: "1 needs you" });
    expect(pill?.detail).toBe("1 needs you, failed, 1 running");
    expect(resolveWorkspacePill([t("Working"), t(null, "error")])?.label).toBe("failed");
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
