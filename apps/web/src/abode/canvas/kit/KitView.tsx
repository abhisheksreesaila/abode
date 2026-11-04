import { useState } from "react";

import { Spinner } from "~/components/ui/spinner";

import { describeCustomizationsError } from "../../customizations/customizationsModel";
import {
  useActiveCustomizationsScope,
  type CustomizationsScope,
} from "../../customizations/useCustomizationsScope";
import { HooksTab, McpTab, PluginsTab, WeeklyMergeTab } from "./KitLists";
import { KitCurator } from "./KitCurator";
import { KitSkillDetail, SourceBadge } from "./KitSkillDetail";
import {
  buildKitMcp,
  buildKitSkills,
  CATEGORIES,
  estimateContext,
  groupByCategory,
  parseHooks,
  parsePlugins,
  SOURCES,
  sourceCounts,
  type CategoryId,
  type KitSkill,
} from "./kitModel";
import { useClaudeSettings, useKitItems } from "./kitState";
import "./kit.css";

type Tab = "skills" | "mcp" | "plugins" | "hooks" | "week";

const CONTEXT_SCALE_K = 20;

function SourcesColumn(props: { readonly skills: ReadonlyArray<KitSkill> }) {
  return (
    <aside data-cvk-col="left">
      <div data-cvk-lab="">Sources</div>
      {sourceCounts(props.skills).map((source) => (
        <div
          key={source.id}
          data-cvk-scard=""
          data-empty={source.inKit === 0 ? "" : undefined}
          style={{ "--sc": SOURCES[source.id].color } as React.CSSProperties}
        >
          <span data-cvk-av="">{SOURCES[source.id].name[0]}</span>
          <div>
            <b>{SOURCES[source.id].name}</b>
            <small>{SOURCES[source.id].by}</small>
          </div>
          <span data-cvk-ct="">
            <b>{source.inKit}</b>/{source.total}
          </span>
        </div>
      ))}
    </aside>
  );
}

function KitColumn(props: {
  readonly skills: ReadonlyArray<KitSkill>;
  readonly category: CategoryId | null;
  readonly onCategory: (category: CategoryId | null) => void;
  readonly onOpen: (skill: KitSkill) => void;
}) {
  const { category } = props;
  const label = CATEGORIES.find((entry) => entry.id === category)?.label;
  return (
    <aside data-cvk-col="right">
      <div data-cvk-lab="">
        Your kit · {props.skills.length} skills
        {category ? (
          <>
            {" · "}showing {label}
            <button type="button" data-cvk-clear="" onClick={() => props.onCategory(null)}>
              clear
            </button>
          </>
        ) : null}
      </div>
      {groupByCategory(props.skills, category).map((group) => (
        <div key={group.id} data-cvk-grp="">
          <button
            type="button"
            data-cvk-gh=""
            aria-label={`Show only ${group.label}`}
            style={{ "--cc": group.color } as React.CSSProperties}
            onClick={() => props.onCategory(category === group.id ? null : group.id)}
          >
            <i data-cvk-cd="" style={{ background: group.color }} />
            {group.label}
            <em>{group.skills.length}</em>
          </button>
          {group.skills.map((skill) => (
            <button
              key={skill.path}
              type="button"
              data-cvk-sk=""
              onClick={() => props.onOpen(skill)}
            >
              <b>{skill.name}</b>
              <SourceBadge id={skill.source} />
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}

function KitBody(props: { readonly scope: CustomizationsScope }) {
  const { scope } = props;
  const { items, failure } = useKitItems(scope);
  const settings = useClaudeSettings(scope);
  const [tab, setTab] = useState<Tab>("skills");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [open, setOpen] = useState<KitSkill | null>(null);

  if (items === null) {
    return failure === null ? (
      <div data-cvk-empty="">
        <Spinner size="sm" />
      </div>
    ) : (
      <div data-cvk-error="">{describeCustomizationsError(failure)}</div>
    );
  }

  const skills = buildKitSkills(items);
  const mcp = buildKitMcp(items);
  const plugins = settings === null ? null : parsePlugins(settings);
  const hooks = settings === null ? null : parseHooks(settings);
  const context = estimateContext(skills, mcp.length);
  const tabs: ReadonlyArray<readonly [Tab, string, number]> = [
    ["skills", "Skills", skills.length],
    ["mcp", "MCP", mcp.length],
    ["plugins", "Plugins", plugins?.filter((plugin) => plugin.enabled).length ?? 0],
    ["hooks", "Hooks", hooks?.length ?? 0],
    ["week", "Weekly merge", 0],
  ];

  return (
    <>
      <div data-cvk-head="">
        <div data-cvk-t="">
          <b>Kit</b>
          <span>what your agents can do, and where each piece came from</span>
        </div>
        <div data-cvk-tabs="">
          {tabs.map(([id, label, count]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
              {label}
              <em>{count}</em>
            </button>
          ))}
        </div>
        <span data-cvk-sp="" />
        <div data-cvk-ctx="">
          <span>context per session (estimate)</span>
          <span data-cvk-cbar="">
            <i
              style={{
                width: `${(context.skillsK / CONTEXT_SCALE_K) * 100}%`,
                background: "#ffd166",
              }}
            />
            <i
              style={{ width: `${(context.mcpK / CONTEXT_SCALE_K) * 100}%`, background: "#4dd4c6" }}
            />
          </span>
          <b>~{context.totalK.toFixed(1)}k</b>
          <small>
            skills {context.skillsK.toFixed(1)}k · MCP {context.mcpK.toFixed(1)}k
          </small>
        </div>
      </div>
      {tab === "skills" ? (
        <div data-cvk-grid="">
          <SourcesColumn skills={skills} />
          <div data-cvk-col="mid">
            <KitCurator
              skills={skills}
              mcpServers={mcp.length}
              onShowDesign={() => setCategory("design")}
            />
          </div>
          <KitColumn
            skills={skills}
            category={category}
            onCategory={setCategory}
            onOpen={setOpen}
          />
        </div>
      ) : null}
      {tab === "mcp" ? <McpTab rows={mcp} cwd={scope.cwd} /> : null}
      {tab === "plugins" ? <PluginsTab rows={plugins} /> : null}
      {tab === "hooks" ? <HooksTab rows={hooks} /> : null}
      {tab === "week" ? <WeeklyMergeTab /> : null}
      {open ? (
        <KitSkillDetail key={open.path} scope={scope} skill={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

/** The Kit (spec 5.10): skills, MCP, plugins, hooks and the weekly merge, in the canvas body. */
export function KitView() {
  const scope = useActiveCustomizationsScope();
  return (
    <div data-cvk="">
      <div data-cvk-phone="">The Kit is desktop only. Open it on a bigger screen.</div>
      {scope ? (
        <KitBody scope={scope} />
      ) : (
        <div data-cvk-empty="">Open a session first, so the Kit knows which machine to read.</div>
      )}
    </div>
  );
}
