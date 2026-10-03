import type {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderOptionSelection,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { UserCogIcon } from "lucide-react";
import { memo, useCallback, useMemo, type ReactNode } from "react";

import { useComposerDraftStore, type DraftId } from "../../composerDraftStore";
import { customizationsEnvironment } from "../../state/customizations";
import { useEnvironmentQuery } from "../../state/query";
import { Menu, MenuGroup, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  ComposerControl,
  ComposerControlChevron,
  ComposerControlIcon,
  type ComposerControlSize,
} from "./ComposerControl";
import {
  DEFAULT_AGENT_LABEL,
  formatAgentName,
  getChosenAgent,
  listAgentChoices,
  resolveComposerAgent,
  withChosenAgent,
  type AgentChoice,
} from "./composerAgent";
import { ClampedDescription } from "./ClampedDescription";
import { useComposerMenuProps } from "./composerEventScope";
import { useComposerMenuState } from "./useComposerMenuState";

const DEFAULT_AGENT_VALUE = "__default__";

export interface ComposerAgentState {
  readonly label: string;
  readonly tooltip: string;
  readonly selectedValue: string;
  readonly choices: ReadonlyArray<AgentChoice>;
  readonly select: (value: string) => void;
}

/**
 * The agent controls of a Claude composer, or null for other providers and for
 * workspaces that define no agents and set none. The list comes from the same
 * merged customizations listing as the sidebar.
 */
export function useComposerAgent(input: {
  provider: ProviderDriverKind;
  instanceId: ProviderInstanceId;
  model: string;
  environmentId: EnvironmentId;
  projectCwd: string | null;
  modelOptions: ReadonlyArray<ProviderOptionSelection> | undefined;
  threadRef?: ScopedThreadRef | undefined;
  draftId?: DraftId | undefined;
}): ComposerAgentState | null {
  const { provider, environmentId, projectCwd, modelOptions } = input;
  const enabled = provider === "claudeAgent" && projectCwd !== null;
  const listAtom = useMemo(
    () =>
      enabled
        ? customizationsEnvironment.list({ environmentId, input: { cwd: projectCwd } })
        : null,
    [enabled, environmentId, projectCwd],
  );
  const { data } = useEnvironmentQuery(listAtom);
  const setProviderModelOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const target = input.threadRef ?? input.draftId;
  const { instanceId, model } = input;
  const select = useCallback(
    (value: string) => {
      if (!target) return;
      setProviderModelOptions(
        target,
        provider,
        withChosenAgent(modelOptions, value === DEFAULT_AGENT_VALUE ? null : value),
        { instanceId, model },
      );
    },
    [instanceId, model, modelOptions, provider, setProviderModelOptions, target],
  );

  const chosen = getChosenAgent(modelOptions);
  const choices = useMemo(() => listAgentChoices(data?.items ?? []), [data]);
  if (!enabled || !target) return null;
  const display = resolveComposerAgent({ chosen, settingsDefault: data?.defaultAgent });
  // Nothing to pick and nothing set: keep the composer free of a useless chip.
  if (display.source === "default" && choices.length === 0) return null;
  return {
    label: display.label,
    tooltip:
      display.source === "settings"
        ? `${display.label} (from settings.json). Applies to the next turn.`
        : `Agent: ${display.label}. Applies to the next turn.`,
    selectedValue:
      display.source === "chosen" ? (display.agent ?? DEFAULT_AGENT_VALUE) : DEFAULT_AGENT_VALUE,
    choices,
    select,
  };
}

/** The radio list, shared by the picker's popup and the overflow menu. */
export function ComposerAgentMenuContent({ agent }: { agent: ComposerAgentState }) {
  const defaultLabel =
    agent.selectedValue === DEFAULT_AGENT_VALUE && agent.label !== DEFAULT_AGENT_LABEL
      ? `${agent.label} (settings.json)`
      : DEFAULT_AGENT_LABEL;
  return (
    <MenuGroup>
      <div className="px-2 pt-1.5 pb-1 font-medium text-muted-foreground text-xs">Agent</div>
      <MenuRadioGroup
        value={agent.selectedValue}
        onValueChange={(value) => {
          if (value) agent.select(value);
        }}
      >
        <MenuRadioItem value={DEFAULT_AGENT_VALUE} closeOnClick>
          {defaultLabel}
        </MenuRadioItem>
        {agent.choices.map((choice) => (
          <MenuRadioItem key={choice.name} value={choice.name} closeOnClick>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{formatAgentName(choice.name)}</span>
              {choice.description ? (
                <ClampedDescription className="text-muted-foreground text-xs">
                  {choice.description}
                </ClampedDescription>
              ) : null}
            </span>
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </MenuGroup>
  );
}

export const ComposerAgentPicker = memo(function ComposerAgentPicker({
  agent,
  size = "sm",
  hidden = false,
}: {
  agent: ComposerAgentState;
  size?: ComposerControlSize;
  hidden?: boolean;
}): ReactNode {
  const composerFloatingLayerProps = useComposerMenuProps();
  const [open, setOpen] = useComposerMenuState(hidden);
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <ComposerControl
                  aria-label={agent.tooltip}
                  data-composer-agent-picker="true"
                  size={size}
                  className="shrink-0 whitespace-nowrap"
                />
              }
            />
          }
        >
          <span
            data-composer-control-compact-icon
            className="pointer-events-none invisible absolute"
          >
            <ComposerControlIcon icon={UserCogIcon} size={size} />
          </span>
          <span data-composer-control-label>{agent.label}</span>
          <ComposerControlChevron size={size} />
        </TooltipTrigger>
        <TooltipPopup side="top">{agent.tooltip}</TooltipPopup>
      </Tooltip>
      <MenuPopup align="start" size="compact" {...composerFloatingLayerProps}>
        <ComposerAgentMenuContent agent={agent} />
      </MenuPopup>
    </Menu>
  );
});
