import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";

import { useWelcomeGreeting } from "../../delights/Delights";
import { useProjectWorkspaceColor } from "../sidebar/workspaceColorHooks";

type ProjectWelcomeProject = Pick<
  EnvironmentProject,
  "environmentId" | "id" | "workspaceRoot" | "repositoryIdentity"
> & { readonly title: string };

/**
 * The welcome for a new thread in a project: a small time-of-day greeting and
 * one centered title with the workspace name in its color. Nothing else, so it
 * stays short enough to sit above the composer without reaching the top bar.
 */
export function ProjectWelcome(props: { readonly project: ProjectWelcomeProject }) {
  const { project } = props;
  const color = useProjectWorkspaceColor(project);
  const accent = color?.color ?? "var(--chip-blue)";
  const greeting = useWelcomeGreeting();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-1 text-center">
      {greeting ? <p className="text-muted-foreground text-sm">{greeting}</p> : null}
      <h1
        aria-label={`What should we build in ${project.title}?`}
        className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl [text-wrap:balance]"
      >
        What should we build in{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 55%, var(--chip-purple)))`,
          }}
        >
          {project.title}
        </span>
        ?
      </h1>
    </div>
  );
}
