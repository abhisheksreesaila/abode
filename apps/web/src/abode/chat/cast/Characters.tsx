/* oxlint-disable shadcn/no-raw-colors -- character art draws in fixed colors, like the brand marks in Icons.tsx */
import { useId, type ReactNode } from "react";

import type { BossLook } from "./bossConfig";

/**
 * abode's original cast, drawn as small inline SVGs: Sunny (Claude's helper), Pip
 * (Codex's helper) and the Boss (the user).
 */

export type Helper = "sunny" | "pip";

function Frame(props: {
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={props.label} className={props.className}>
      {props.children}
    </svg>
  );
}

function Eye(props: { cx: number; cy: number; rx: number; ry: number; r: number; fill: string }) {
  const { cx, cy, rx, ry, r, fill } = props;
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#f4f7fb" />
      <circle cx={cx + 1.5} cy={cy + 2.5} r={r} fill={fill} />
      <circle cx={cx + 3} cy={cy} r={r * 0.36} fill="#fff" />
    </>
  );
}

function SunnyBody({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-b`} cx="40%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffe680" />
          <stop offset=".65" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d98a06" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="94" rx="26" ry="4" fill="#000" opacity=".25" />
      <path
        d="M50 10 C50 4 54 2 58 4"
        stroke="#6b8f3a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M58 4 l3 -4 l1 5 l5 1 l-4 3 l1 5 l-4 -3 l-5 2 l2 -5 l-3 -4z" fill="#e8743b" />
      <path
        d="M50 12 C76 12 86 38 86 58 C86 80 70 92 50 92 C30 92 14 80 14 58 C14 38 24 12 50 12z"
        fill={`url(#${id}-b)`}
      />
      <ellipse
        cx="36"
        cy="30"
        rx="9"
        ry="5"
        fill="#fff"
        opacity=".35"
        transform="rotate(-25 36 30)"
      />
      <Eye cx={38} cy={52} rx={10} ry={12} r={5.5} fill="#3b2a1a" />
      <Eye cx={62} cy={52} rx={10} ry={12} r={5.5} fill="#3b2a1a" />
      <ellipse cx="28" cy="68" rx="5" ry="3" fill="#f2785c" opacity=".55" />
      <ellipse cx="72" cy="68" rx="5" ry="3" fill="#f2785c" opacity=".55" />
      <path
        d="M42 72 Q50 79 58 72"
        stroke="#5a3a1a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M22 82 Q50 96 78 82 L76 88 Q50 100 24 88z" fill="#e8743b" />
    </>
  );
}

function PipBody({ id }: { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-b`} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff3a3" />
          <stop offset=".6" stopColor="#facc15" />
          <stop offset="1" stopColor="#b9900a" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="94" rx="28" ry="4" fill="#000" opacity=".25" />
      <rect x="16" y="18" width="68" height="72" rx="24" fill={`url(#${id}-b)`} />
      <ellipse
        cx="34"
        cy="30"
        rx="10"
        ry="5"
        fill="#fff"
        opacity=".35"
        transform="rotate(-20 34 30)"
      />
      <path d="M18 46 C18 14 82 14 82 46" stroke="#2bb5a0" strokeWidth="5" fill="none" />
      <rect x="10" y="40" width="12" height="18" rx="5" fill="#2bb5a0" />
      <rect x="78" y="40" width="12" height="18" rx="5" fill="#2bb5a0" />
      <path d="M84 56 Q86 72 70 74" stroke="#2bb5a0" strokeWidth="3" fill="none" />
      <circle cx="68" cy="74" r="3.5" fill="#1f8f7f" />
      <Eye cx={39} cy={50} rx={8} ry={10} r={4.5} fill="#1d2b2a" />
      <Eye cx={61} cy={50} rx={8} ry={10} r={4.5} fill="#1d2b2a" />
      <path
        d="M43 68 Q50 73 57 68"
        stroke="#5a4a0a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="30" y="80" width="40" height="6" rx="3" fill="#2bb5a0" opacity=".8" />
    </>
  );
}

export function HelperAvatar(props: {
  readonly helper: Helper;
  readonly name: string;
  readonly className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <Frame label={props.name} className={props.className}>
      {props.helper === "sunny" ? <SunnyBody id={id} /> : <PipBody id={id} />}
    </Frame>
  );
}

function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

const BROW = "#3b2a20";

export function BossAvatar(props: {
  readonly look: BossLook;
  readonly photo?: string | null;
  readonly name: string;
  readonly className?: string;
}) {
  const { look, photo, name, className } = props;
  if (photo) {
    return <img src={photo} alt={name} className={className} data-abode="boss-photo" />;
  }
  return (
    <Frame label={name} className={className}>
      <ellipse cx="50" cy="95" rx="26" ry="4" fill="#000" opacity=".25" />
      <circle cx="50" cy="50" r="30" fill={look.skin} />
      <circle cx="42" cy="38" r="12" fill="#fff" opacity=".18" />
      {look.top === "crown" ? (
        <path
          d="M30 22 l6 -14 l8 10 l6 -12 l6 12 l8 -10 l6 14z"
          fill="#f59e0b"
          stroke="#b45309"
          strokeWidth="1.5"
        />
      ) : look.top === "cap" ? (
        <>
          <path d="M22 38 Q50 6 78 38z" fill={look.scarf} />
          <path d="M60 36 Q84 34 92 40 Q76 44 62 42z" fill={shade(look.scarf, 0.7)} />
        </>
      ) : look.top === "hair" ? (
        <path
          d="M24 40 l4 -16 l8 8 l4 -14 l8 10 l6 -14 l6 14 l8 -10 l4 14 l6 -6 l2 14z"
          fill={BROW}
        />
      ) : look.top === "beanie" ? (
        <>
          <path d="M22 40 Q22 12 50 12 Q78 12 78 40z" fill={look.scarf} />
          <rect x="20" y="34" width="60" height="8" rx="4" fill={shade(look.scarf, 0.75)} />
          <circle cx="50" cy="10" r="6" fill="#e7e1d8" />
        </>
      ) : null}
      {look.brows === "big" ? (
        <>
          <path
            d="M30 40 q8 -6 16 -1"
            stroke={BROW}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M54 39 q8 -5 16 1"
            stroke={BROW}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : look.brows === "calm" ? (
        <path d="M32 41 h12 M56 41 h12" stroke={BROW} strokeWidth="3" strokeLinecap="round" />
      ) : null}
      {look.eyes === "shades" ? (
        <>
          <rect x="28" y="44" width="20" height="11" rx="4" fill="#1a1a1a" />
          <rect x="52" y="44" width="20" height="11" rx="4" fill="#1a1a1a" />
          <path d="M48 48 h4" stroke="#1a1a1a" strokeWidth="3" />
        </>
      ) : (
        <>
          <circle cx="39" cy="50" r="4" fill="#2a1c14" />
          <circle cx="61" cy="50" r="4" fill="#2a1c14" />
          <circle cx="40.5" cy="48.5" r="1.4" fill="#fff" />
          <circle cx="62.5" cy="48.5" r="1.4" fill="#fff" />
          {look.eyes === "round" ? (
            <>
              <circle cx="39" cy="50" r="9" fill="none" stroke="#2a2a2a" strokeWidth="2.5" />
              <circle cx="61" cy="50" r="9" fill="none" stroke="#2a2a2a" strokeWidth="2.5" />
              <path d="M48 50 h4" stroke="#2a2a2a" strokeWidth="2.5" />
            </>
          ) : null}
        </>
      )}
      <ellipse cx="50" cy="58" rx="5" ry="4" fill={shade(look.skin, 0.82)} />
      <path
        d="M38 66 Q50 76 62 66"
        stroke="#5a2a1a"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M22 78 Q50 92 78 78 L80 90 Q50 102 20 90z" fill="#3a3330" />
      <path
        d="M30 82 L34 95 M42 86 L44 98 M56 86 L56 98 M68 82 L66 95"
        stroke={look.scarf}
        strokeWidth="3"
      />
    </Frame>
  );
}
