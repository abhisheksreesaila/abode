import type { CustomizationItem } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  getChosenAgent,
  keepChosenAgent,
  listAgentChoices,
  resolveComposerAgent,
  withChosenAgent,
} from "./composerAgent";

const agent = (name: string, scope: "user" | "workspace"): CustomizationItem => ({
  kind: "agent",
  name,
  path: `/${scope}/${name}.md`,
  scope,
  readOnly: false,
});

describe("resolveComposerAgent", () => {
  it("shows plain Claude Code when nothing is set", () => {
    expect(resolveComposerAgent({ chosen: null, settingsDefault: undefined })).toEqual({
      agent: null,
      label: "Claude Code",
      source: "default",
    });
  });

  it("shows the settings.json agent when nothing is chosen", () => {
    expect(resolveComposerAgent({ chosen: null, settingsDefault: "orchestrator" })).toEqual({
      agent: "orchestrator",
      label: "Orchestrator",
      source: "settings",
    });
  });

  it("lets a chosen agent win over settings.json", () => {
    expect(
      resolveComposerAgent({ chosen: "code-reviewer", settingsDefault: "orchestrator" }),
    ).toEqual({ agent: "code-reviewer", label: "Code Reviewer", source: "chosen" });
  });
});

describe("agent option", () => {
  it("round-trips through the model options without touching other options", () => {
    const options = withChosenAgent([{ id: "effort", value: "high" }], "orchestrator");
    expect(options).toEqual([
      { id: "effort", value: "high" },
      { id: "agent", value: "orchestrator" },
    ]);
    expect(getChosenAgent(options)).toBe("orchestrator");
  });

  it("clears the agent and drops an empty option list", () => {
    expect(withChosenAgent([{ id: "agent", value: "orchestrator" }], null)).toBeUndefined();
    expect(
      withChosenAgent(
        [
          { id: "agent", value: "orchestrator" },
          { id: "effort", value: "high" },
        ],
        null,
      ),
    ).toEqual([{ id: "effort", value: "high" }]);
  });

  it("survives a trait edit that rebuilt the options from descriptors", () => {
    expect(
      keepChosenAgent(
        [{ id: "effort", value: "max" }],
        [
          { id: "effort", value: "high" },
          { id: "agent", value: "orchestrator" },
        ],
      ),
    ).toEqual([
      { id: "effort", value: "max" },
      { id: "agent", value: "orchestrator" },
    ]);
    expect(keepChosenAgent(undefined, [{ id: "agent", value: "orchestrator" }])).toEqual([
      { id: "agent", value: "orchestrator" },
    ]);
  });
});

describe("listAgentChoices", () => {
  it("lists agents only, sorted, with a workspace agent shadowing a user one", () => {
    const choices = listAgentChoices([
      agent("reviewer", "user"),
      agent("developer", "user"),
      { ...agent("reviewer", "workspace"), description: "project reviewer" },
      { ...agent("skill-like", "user"), kind: "skill" },
    ]);
    expect(choices).toEqual([
      { name: "developer", description: undefined },
      { name: "reviewer", description: "project reviewer" },
    ]);
  });
});
