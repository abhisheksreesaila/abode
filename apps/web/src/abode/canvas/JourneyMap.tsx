import { useId, useLayoutEffect, useRef } from "react";

import type { ComposeSession } from "./composeBlocks";
import { journeyLayout, robotSymbol, symbolTone } from "./journeyMap";
import type { PlanBlock } from "./planBlock";
import "./journey.css";

type Point = readonly [number, number];

const HOP_MS = 380;

/** Eases the robot from stand to stand with a small arc; returns a cancel. Prototype `hop`. */
function hop(
  svg: SVGSVGElement,
  bot: SVGGElement,
  stands: ReadonlyArray<Point>,
  from: number,
  to: number,
): () => void {
  let frame = 0;
  let cancelled = false;
  const place = (x: number, y: number) => bot.setAttribute("transform", `translate(${x} ${y})`);
  const dir = to > from ? 1 : -1;
  const arrive = () => {
    const stations = svg.querySelectorAll("[data-j-st]");
    stations[to - 1]?.animate([{ scale: 0.8 }, { scale: 1.12, offset: 0.6 }, { scale: 1 }], {
      duration: 600,
      easing: "cubic-bezier(0.3, 1.6, 0.5, 1)",
    });
  };
  const leg = (i: number) => {
    if (cancelled) return;
    if (i === to) return arrive();
    const [ax, ay] = stands[i]!;
    const [bx, by] = stands[i + dir]!;
    const t0 = performance.now();
    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / HOP_MS);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      place(ax + (bx - ax) * e, ay + (by - ay) * e - Math.sin(Math.PI * t) * 30);
      if (t < 1) frame = requestAnimationFrame(step);
      else leg(i + dir);
    };
    frame = requestAnimationFrame(step);
  };
  place(...stands[from]!);
  leg(from);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The journey map block (spec 5.3): a hand-drawn route from the house through the milestones to the goal. */
export function JourneyMap(props: {
  readonly plan: Extract<PlanBlock, { kind: "ready" }>;
  readonly sessions: ReadonlyArray<ComposeSession>;
}) {
  const { plan, sessions } = props;
  const layout = journeyLayout(plan.rows, plan.goal);
  const symbol = robotSymbol({ done: layout.done, sessions });
  const filterId = `jsk${useId().replaceAll(/\W/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const botRef = useRef<SVGGElement>(null);
  const shownAt = useRef<number | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const standsKey = JSON.stringify(layout.stands);
  const { cur } = layout;

  // The robot hops only when the current milestone moves forward; any other change just places it.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- moves an SVG node by hand; React does not own its transform
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const bot = botRef.current;
    if (!svg || !bot) return;
    const stands: Point[] = JSON.parse(standsKey);
    const from = shownAt.current;
    shownAt.current = cur;
    if (from !== null && from < cur && !reducedMotion()) {
      cancel.current = hop(svg, bot, stands, from, cur);
    } else {
      const [x, y] = stands[cur]!;
      bot.setAttribute("transform", `translate(${x} ${y})`);
    }
    return () => cancel.current?.();
  }, [cur, standsKey, svgRef, botRef, shownAt, cancel]);

  const replay = () => {
    const svg = svgRef.current;
    const bot = botRef.current;
    if (!svg || !bot) return;
    cancel.current?.();
    const stands: Point[] = JSON.parse(standsKey);
    if (reducedMotion()) {
      const [x, y] = stands[cur]!;
      bot.setAttribute("transform", `translate(${x} ${y})`);
      return;
    }
    cancel.current = hop(svg, bot, stands, 0, cur);
  };

  const filter = `url(#${filterId})`;
  const jamming = sessions.some((session) => session.mode === "jam" && session.status !== "landed");
  const currentStation = layout.stations.find((station) => station.state === "current");
  const [startX, startY] = layout.start;
  const [goalX, goalY] = layout.goalFoot;
  return (
    <div data-cv-map="" role="img" aria-label={`Journey map. ${plan.goal ?? "Plan"}`}>
      <button type="button" data-cv-play="" aria-label="Play the journey" onClick={replay}>
        ▶
      </button>
      <svg ref={svgRef} viewBox="0 0 1000 170">
        <defs>
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed={7} />
            <feDisplacementMap in="SourceGraphic" scale="2.4" />
          </filter>
        </defs>
        <g filter={filter}>
          <path data-j-path="" d={layout.path} />
          <path
            data-j-path="done"
            d={layout.path}
            style={{ strokeDasharray: `${layout.walked * 1400} 2000` }}
          />
        </g>
        <g data-j-start="" transform={`translate(${startX} ${startY})`} filter={filter}>
          <path d="M-14 6 v-13 l14 -12 l14 12 v13 z" data-j-house="" />
          <rect x="-4" y="-2" width="8" height="8" data-j-door="" />
        </g>
        <text data-j-small="" x={startX} y={startY + 28} textAnchor="middle">
          start
        </text>
        <g filter={filter}>
          {layout.stations.map((station, i) => (
            <g
              key={plan.rows[i]?.key ?? station.name}
              data-j-st=""
              data-state={station.state}
              transform={`translate(${station.x} ${station.y}) rotate(${station.rotate})`}
            >
              <rect
                data-j-shadow=""
                x={-station.width / 2 + 3}
                y={-station.height / 2 + 4}
                width={station.width}
                height={station.height}
                rx="13"
              />
              <rect
                data-j-face=""
                x={-station.width / 2}
                y={-station.height / 2}
                width={station.width}
                height={station.height}
                rx="13"
              />
              <text data-j-label="" y="6" textAnchor="middle">
                {station.label}
              </text>
              {station.state === "done" ? (
                <g transform={`translate(${station.width / 2 - 4} ${-station.height / 2 + 2})`}>
                  <circle r="9" data-j-check="" />
                  <path d="M-4 0 l3 3 l5 -6" data-j-tick="" />
                </g>
              ) : null}
            </g>
          ))}
        </g>
        <g data-j-goal="" transform={`translate(${goalX} ${goalY})`}>
          <ellipse rx="34" ry="9" data-j-hill="" filter={filter} />
          <path d="M0 0 v-46" data-j-pole="" />
          <path d="M0 -46 l26 8 l-26 8 z" data-j-flag={layout.done ? "won" : ""} filter={filter} />
        </g>
        {layout.goalLines.map((line, k) => (
          <text key={line} data-j-goaltext="" x={goalX} y={goalY + 24 + k * 15} textAnchor="middle">
            {line}
          </text>
        ))}
        {jamming && currentStation ? (
          <g
            data-j-jam=""
            transform={`translate(${currentStation.x + currentStation.width / 2 - 2} ${currentStation.y - currentStation.height / 2 - 30})`}
          >
            <path d="M-16 6 a8 8 0 0 1 2 -15 a10 10 0 0 1 18 -3 a8 8 0 0 1 12 9 a7 7 0 0 1 -2 13 z" />
            <text x="0" y="5" textAnchor="middle" data-j-note="">
              ♪
            </text>
          </g>
        ) : null}
        <g ref={botRef} data-j-bot="">
          <path d="M-7 12 l-3 7 M7 12 l3 7" data-j-line="" />
          <ellipse rx="15" ry="13" data-j-body="" />
          <path d="M0 -13 v-7" data-j-line="" />
          <circle cy="-22" r="3" data-j-ant="" />
          <circle cx="-5" cy="-2" r="2.7" data-j-eye="" />
          <circle cx="5" cy="-2" r="2.7" data-j-eye="" />
          <path d="M-4 5 q4 4 8 0" data-j-line="" />
          <g transform="translate(14 -30)">
            <rect x="0" y="-14" width="24" height="21" rx="9" data-j-bubble="" />
            <path d="M4 6 l-4 6 l9 -5" data-j-bubble="" />
            <text
              x="12"
              y="2"
              textAnchor="middle"
              data-j-sym=""
              style={{ fill: symbolTone(symbol) }}
            >
              {symbol}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
