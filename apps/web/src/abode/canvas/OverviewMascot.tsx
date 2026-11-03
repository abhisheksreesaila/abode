import { machineFace } from "./overviewModel";

const INK = "#1c1c20";
const DROP = "M0 0 q2.4 3.6 0 5.4 q-2.4 -1.8 0 -5.4z";

/** A laptop (this host) or a Mac mini (a linked Mac) in the machine's colour; the face follows its load. */
export function OverviewMascot(props: {
  readonly kind: "laptop" | "mini";
  readonly colour: string;
  readonly cpu: number | null;
}) {
  const face = machineFace(props.cpu);
  const cx = 30;
  const cy = props.kind === "mini" ? 29 : 19;
  const body = props.colour;
  const trim = `color-mix(in srgb, ${props.colour} 45%, white)`;
  return (
    <svg viewBox="0 0 60 50" aria-hidden data-cv-ov-mico="" data-face={face}>
      {props.kind === "mini" ? (
        <>
          <ellipse cx="30" cy="45" rx="20" ry="2.6" fill={INK} opacity=".18" />
          <path
            d="M10 22 L15 15 H45 L50 22 Z"
            fill={trim}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <rect
            x="8"
            y="21"
            width="44"
            height="21"
            rx="7"
            fill={body}
            stroke={INK}
            strokeWidth="2.4"
          />
          <circle cx="45" cy="36" r="1.6" fill="var(--cv-ov-led)" stroke={INK} strokeWidth=".8" />
        </>
      ) : (
        <>
          <ellipse cx="30" cy="47" rx="24" ry="2.4" fill={INK} opacity=".18" />
          <rect
            x="11"
            y="6"
            width="38"
            height="29"
            rx="5"
            fill={body}
            stroke={INK}
            strokeWidth="2.4"
          />
          <rect
            x="15.5"
            y="10"
            width="29"
            height="20.5"
            rx="3"
            fill="var(--cv-ov-screen)"
            stroke={INK}
            strokeWidth="1.6"
          />
          <path
            d="M4 37 H56 L52.5 43 H7.5 Z"
            fill={trim}
            stroke={INK}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M25 37 h10" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      <circle cx={cx - 5} cy={cy} r="1.9" fill={INK} />
      <circle cx={cx + 5} cy={cy} r="1.9" fill={INK} />
      <circle cx={cx - 9} cy={cy + 4} r="2.2" fill="var(--cv-ov-blush)" opacity=".55" />
      <circle cx={cx + 9} cy={cy + 4} r="2.2" fill="var(--cv-ov-blush)" opacity=".55" />
      {face === "smile" ? (
        <path
          d={`M${cx - 3.5} ${cy + 3.5} q3.5 3.5 7 0`}
          fill="none"
          stroke={INK}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <ellipse cx={cx} cy={cy + 5} rx="1.9" ry="1.6" fill={INK} />
      )}
      {face !== "smile" ? (
        <path
          d={DROP}
          transform={`translate(${cx + 13} ${cy - 6})`}
          fill="var(--cv-ov-sweat)"
          stroke={INK}
          strokeWidth="1"
        />
      ) : null}
      {face === "hot" ? (
        <path
          d={DROP}
          transform={`translate(${cx - 15} ${cy - 7})`}
          fill="var(--cv-ov-sweat)"
          stroke={INK}
          strokeWidth="1"
        />
      ) : null}
    </svg>
  );
}
