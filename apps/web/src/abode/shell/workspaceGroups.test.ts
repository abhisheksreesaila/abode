import { describe, expect, it } from "vite-plus/test";

import { buildWorkspaceGroups } from "./workspaceGroups";

const ref = (projectId: string) => ({ environmentId: "env", projectId });

function snapshot(
  projectKey: string,
  projectId: string,
  displayName: string,
  workspaceRoot: string,
) {
  const member = { environmentId: "env", id: projectId, workspaceRoot, title: displayName };
  return {
    ...member,
    projectKey,
    displayName,
    memberProjects: [member],
    memberProjectRefs: [ref(projectId)],
  };
}

let seq = 0;
function thread(id: string, projectId: string, parent: string | null = null, status = "idle") {
  seq += 1;
  return {
    environmentId: "env",
    id,
    projectId,
    title: `title ${id}`,
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)).toISOString(),
    archivedAt: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    runtime: { status },
    lineage: {
      parentThreadId: parent,
      relationshipToParent: parent ? "subagent" : null,
    },
  };
}

describe("buildWorkspaceGroups", () => {
  const build = () =>
    buildWorkspaceGroups({
      snapshots: [
        snapshot("repo", "p1", "t3code", "/home/me/t3code"),
        snapshot("scratch", "p2", "scratch-1", "/home/me/.scratch"),
      ] as never,
      threads: [
        thread("root", "p1"),
        thread("child", "p1", "root", "running"),
        thread("chat", "p2"),
      ] as never,
      projectSortOrder: "manual",
      threadSortOrder: "created_at",
      isScratchMember: (member) => member.workspaceRoot === "/home/me/.scratch",
    });

  it("names the scratch project Chats and keeps the repo's own name", () => {
    const groups = build();
    expect(groups.map((g) => [g.name, g.isScratch])).toEqual([
      ["t3code", false],
      ["Chats", true],
    ]);
  });

  it("lists only top-level sessions, with the running subagent attached to its parent", () => {
    const [repo, chats] = build();
    expect(repo!.threads.map((t) => t.id)).toEqual(["root"]);
    expect(repo!.runningSubagentsByParentKey.get("env:root")?.map((t) => t.id)).toEqual(["child"]);
    expect(chats!.threads.map((t) => t.id)).toEqual(["chat"]);
    expect(chats!.runningSubagentsByParentKey.size).toBe(0);
  });
});
