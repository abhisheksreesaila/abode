import { useAtomValue } from "@effect/atom-react";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { Spinner } from "~/components/ui/spinner";

import { describeCustomizationsError } from "../customizations/customizationsModel";
import type { CustomizationsScope } from "../customizations/useCustomizationsScope";
import { HooksTab, McpTab, PluginsTab } from "../canvas/kit/KitLists";
import { KitSkillDetail, SourceBadge } from "../canvas/kit/KitSkillDetail";
import {
  SOURCES,
  buildKitMcp,
  buildKitSkills,
  estimateContext,
  skillTokens,
  type KitSkill,
} from "../canvas/kit/kitModel";
import { pruneAskPrompt } from "../chat/prune/pruneAsk";
import { fillComposer } from "../composerFill";
import { useClaudeSettings, useKitItems } from "../canvas/kit/kitState";
import type { AgentCard } from "./agentCards";
import "../canvas/kit/kit.css";
import { skillUsageAtom, useSkillSourcesState } from "./kitData";
import { dailyCheckCard, lastUsedLabel } from "./kitMode";
import { UpdatesPane } from "./UpdatesPane";
import { pendingCount } from "./updatesModel";

const KIT_TABS = ["jam", "skills", "mcp", "plugins", "hooks", "updates"] as const;
export type KitTab = (typeof KIT_TABS)[number];

const KIT_TAB_LABEL: Record<KitTab, string> = {
  jam: "Jam",
  skills: "Skills",
  mcp: "MCP",
  plugins: "Plugins",
  hooks: "Hooks",
  updates: "Updates",
};
const CONTEXT_SCALE_K = 20;

/** Jam, Skills, MCP, Plugins, Hooks, Updates: counts only where the host already told us. */
export function KitTabs(props: {
  readonly scope: CustomizationsScope;
  readonly tab: KitTab;
  readonly onTab: (tab: KitTab) => void;
}) {
  const { scope, tab, onTab } = props;
  const { items } = useKitItems(scope);
  const pending = pendingCount(useSkillSourcesState(scope.environmentId));
  const counts: Partial<Record<KitTab, number | undefined>> = {
    skills: items === null ? undefined : buildKitSkills(items).length,
    mcp: items === null ? undefined : buildKitMcp(items).length,
    updates: pending > 0 ? pending : undefined,
  };
  return (
    <div data-abode-tabs="" data-kit="" role="tablist" aria-label="Kit views">
      {KIT_TABS.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          data-selected={tab === value ? "" : undefined}
          data-testid={`kit-tab-${value}`}
          onClick={() => onTab(value)}
        >
          {KIT_TAB_LABEL[value]}
          {counts[value] === undefined ? null : <small>{counts[value]}</small>}
        </button>
      ))}
    </div>
  );
}

/** "Context per session": skills and MCP stacked, and the mono total. */
export function KitMeter(props: {
  readonly scope: CustomizationsScope;
  readonly where: "head" | "pane";
}) {
  const { items } = useKitItems(props.scope);
  if (items === null) return null;
  const context = estimateContext(buildKitSkills(items), buildKitMcp(items).length);
  return (
    <div data-abode-meter="" data-where={props.where} data-testid="kit-meter">
      <span data-abode-meter-label="">Context per session</span>
      <span
        data-abode-meter-bar=""
        role="img"
        aria-label={`Skills ${context.skillsK.toFixed(1)}k, MCP ${context.mcpK.toFixed(1)}k tokens`}
      >
        <i data-part="skills" style={{ width: `${(context.skillsK / CONTEXT_SCALE_K) * 100}%` }} />
        <i data-part="mcp" style={{ width: `${(context.mcpK / CONTEXT_SCALE_K) * 100}%` }} />
      </span>
      <b>~{context.totalK.toFixed(1)}k</b>
    </div>
  );
}

/** The strip: the daily source check, and the Kit thread's own agent. */
export function KitStrip(props: {
  readonly scope: CustomizationsScope;
  readonly agent: AgentCard | null;
  readonly nowMs: number;
  readonly onTab: (tab: KitTab) => void;
}) {
  const { scope, agent, nowMs, onTab } = props;
  const check = dailyCheckCard(useSkillSourcesState(scope.environmentId), nowMs);
  return (
    <div data-abode-strip="" data-kit="" aria-label="Kit agents">
      <button
        type="button"
        data-abode-card=""
        data-status={check.status}
        data-testid="kit-check-card"
        onClick={() => onTab("updates")}
      >
        <span data-abode-card-top="">
          <b>daily check</b>
          <span data-abode-card-meta="">06:00 daily</span>
          <span data-abode-card-status="">{check.statusLabel}</span>
        </span>
        <span data-abode-card-doing="">{check.doing}</span>
      </button>
      <button
        type="button"
        data-abode-card=""
        data-status={agent?.status ?? "idle"}
        data-testid="kit-agent-card"
        onClick={() => onTab("jam")}
      >
        <span data-abode-card-top="">
          <b>kit agent</b>
          <span data-abode-card-meta="">{agent?.meta ?? "~"}</span>
          <span data-abode-card-status="">{agent?.statusLabel ?? "idle"}</span>
        </span>
        <span data-abode-card-doing="">{agent?.doing ?? "Ask below: what don't I need?"}</span>
      </button>
    </div>
  );
}

function SkillsList(props: {
  readonly scope: CustomizationsScope;
  readonly skills: ReadonlyArray<KitSkill>;
  readonly nowMs: number;
  readonly onJam: () => void;
}) {
  const { scope, skills, nowMs, onJam } = props;
  const [open, setOpen] = useState<KitSkill | null>(null);
  const usage = useAtomValue(
    skillUsageAtom({ environmentId: scope.environmentId, input: { scan: true } }),
  );
  const loaded = Option.getOrNull(AsyncResult.value(usage));
  const lastUsed = new Map(loaded?.skills.map((entry) => [entry.name, entry.lastUsedAt]));
  // Never-used skills first, so a long list cut at the cap still holds the likeliest cuts.
  const askPrune = () => {
    if (scope.threadRef === null) return;
    const used = (skill: KitSkill) => Date.parse(lastUsed.get(skill.name) ?? "") || 0;
    fillComposer(
      scope.threadRef,
      pruneAskPrompt(
        skills
          .toSorted((a, b) => used(a) - used(b))
          .map((skill) => ({
            name: skill.name,
            source: SOURCES[skill.source].name,
            tokens: skillTokens(skill),
            lastUsed: loaded === null ? "unknown" : lastUsedLabel(lastUsed.get(skill.name), nowMs),
          })),
      ),
    );
    onJam();
  };
  return (
    <>
      <button
        type="button"
        data-abode-prune-ask=""
        data-testid="kit-prune-ask"
        disabled={scope.threadRef === null}
        onClick={askPrune}
      >
        What don't I need?
      </button>
      <div data-abode-skills="" role="list">
        {skills.map((skill) => (
          <button
            key={skill.path}
            type="button"
            role="listitem"
            data-abode-skill=""
            data-testid="kit-skill-row"
            onClick={() => setOpen(skill)}
          >
            <span data-abode-skill-name="">
              <b>{skill.name}</b>
              <small>{skill.description}</small>
            </span>
            <SourceBadge id={skill.source} />
            <span data-abode-skill-cost="">~{skillTokens(skill)} tok</span>
            <span data-abode-skill-used="" data-testid="kit-skill-used">
              {loaded === null ? "…" : lastUsedLabel(lastUsed.get(skill.name), nowMs)}
            </span>
          </button>
        ))}
      </div>
      {open ? (
        <KitSkillDetail key={open.path} scope={scope} skill={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

/** The pane over the timeline for every Kit tab but Jam. */
export function KitPane(props: {
  readonly scope: CustomizationsScope;
  readonly tab: Exclude<KitTab, "jam">;
  readonly nowMs: number;
  readonly onTab: (tab: KitTab) => void;
}) {
  const { scope, tab, nowMs, onTab } = props;
  const { items, failure } = useKitItems(scope);
  const settings = useClaudeSettings(scope);
  const body = (() => {
    if (tab === "updates") return <UpdatesPane scope={scope} onJam={() => onTab("jam")} />;
    if (items === null) {
      return failure === null ? (
        <div data-cvk-empty="">
          <Spinner size="sm" />
        </div>
      ) : (
        <div data-cvk-error="">{describeCustomizationsError(failure)}</div>
      );
    }
    if (tab === "skills") {
      return (
        <SkillsList
          scope={scope}
          skills={buildKitSkills(items)}
          nowMs={nowMs}
          onJam={() => onTab("jam")}
        />
      );
    }
    if (tab === "mcp") return <McpTab rows={buildKitMcp(items)} cwd={scope.cwd} />;
    if (tab === "plugins") return <PluginsTab rows={settings?.plugins ?? null} />;
    return <HooksTab rows={settings?.hooks ?? null} />;
  })();
  return (
    <section
      data-abode-frame-pane=""
      data-kit=""
      aria-label={KIT_TAB_LABEL[tab]}
      data-testid="frame-pane"
    >
      <div data-abode-kit-body="">
        <KitMeter scope={scope} where="pane" />
        {body}
      </div>
    </section>
  );
}
