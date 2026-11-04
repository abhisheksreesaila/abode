import type {
  EnvironmentId,
  MessageId,
  ModelSelection,
  ProjectId,
  ThreadId,
} from "@t3tools/contracts";

/** A session's title from its first message: the first line, cut to 60 characters. */
export function sessionTitle(firstMessage: string): string {
  const line =
    firstMessage
      .split("\n")
      .find((entry) => entry.trim() !== "")
      ?.trim() ?? "";
  if (line === "") return "New session";
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}

/** The project's default model when it has one, else the first usable provider's default. */
export function chooseModel<T>(projectDefault: T | null, fallback: T | null): T | null {
  return projectDefault ?? fallback;
}

/**
 * The one startTurn command that creates a session with its first message (bootstrap.createThread,
 * approval-required, the project's default model else the fallback), or why it cannot start.
 */
export function buildStartSession(input: {
  readonly project: { readonly environmentId: EnvironmentId; readonly id: ProjectId } | undefined;
  readonly projectModel: ModelSelection | null;
  readonly fallbackModel: ModelSelection | null;
  readonly text: string;
  readonly threadId: ThreadId;
  readonly messageId: MessageId;
  readonly createdAt: string;
}) {
  const text = input.text.trim();
  if (text === "") return { error: "Write a first message to start a session." } as const;
  if (input.project === undefined) {
    return { error: "This workspace has no project to start a session in." } as const;
  }
  const modelSelection = chooseModel(input.projectModel, input.fallbackModel);
  if (modelSelection === null)
    return { error: "No model is available to start a session." } as const;
  const title = sessionTitle(text);
  const { createdAt, threadId } = input;
  return {
    error: null,
    environmentId: input.project.environmentId,
    input: {
      threadId,
      message: { messageId: input.messageId, role: "user", text, attachments: [] },
      modelSelection,
      titleSeed: title,
      runtimeMode: "approval-required",
      interactionMode: "default",
      bootstrap: {
        createThread: {
          projectId: input.project.id,
          title,
          modelSelection,
          runtimeMode: "approval-required",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt,
        },
      },
      createdAt,
    },
  } as const;
}
