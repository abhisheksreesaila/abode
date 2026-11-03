import type { SessionMode } from "./sessionMode";

const ICON_PATHS: Record<SessionMode, ReadonlyArray<string>> = {
  auto: ["M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z"],
  tell: ["M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z", "M8 8h8M8 12h5"],
  grill: [
    "M12 22c4 0 7-2.8 7-7 0-4-3-6.5-4-9.5-.6 2-1.8 3.2-3 3.8C12 6.5 10.5 4 8.5 2 8.8 6 5 8.6 5 14.5 5 19 8 22 12 22Z",
    "M12 22c-1.7 0-3-1.4-3-3.2 0-2 1.6-3 3-4.8 1.4 1.8 3 2.8 3 4.8 0 1.8-1.3 3.2-3 3.2Z",
  ],
  jam: [
    "M9 18V5l11-2v13",
    "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    "M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  ],
};

/** Paper plane, speech bubble, flame or music note, in the mode's colour (set by CSS). */
export function ModeIcon(props: { readonly mode: SessionMode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden data-cv-mode={props.mode}>
      {ICON_PATHS[props.mode].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const INK = "var(--cv-masc-ink)";

/** Ember, the Grill me flame. Stern while a question is open, happy when there is none. */
export function Ember(props: { readonly happy: boolean }) {
  const { happy } = props;
  return (
    <svg data-cv-masc="ember" data-happy={happy ? "" : undefined} viewBox="0 0 60 68" aria-hidden>
      <ellipse cx="30" cy="65" rx="16" ry="2.4" fill={INK} opacity=".2" />
      <path
        d="M30 4C38 16 52 22 50 42C49 56 40 62 30 62C20 62 11 56 10 42C10 31 17 27 20 16C23 22 25 24 28 24C28 16 27 10 30 4Z"
        fill="var(--cv-ember-body)"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M30 30C36 36 42 41 40 50C39 56 34 58 30 58C26 58 21 56 20 50C19 44 24 42 26 36C28 38 29 36 30 30Z"
        fill="var(--cv-ember-core)"
      />
      <ellipse
        cx="24"
        cy="43"
        rx="4"
        ry="4.4"
        fill="var(--cv-masc-eye)"
        stroke={INK}
        strokeWidth="1.6"
      />
      <ellipse
        cx="36"
        cy="43"
        rx="4"
        ry="4.4"
        fill="var(--cv-masc-eye)"
        stroke={INK}
        strokeWidth="1.6"
      />
      <circle cx={happy ? 24 : 25} cy="44" r="2" fill={INK} />
      <circle cx={happy ? 36 : 35} cy="44" r="2" fill={INK} />
      {happy ? (
        <>
          <path
            d="M19 35q5-3 9 0M32 35q5-3 9 0"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M25 51q5 5 10 0"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M18.5 35.5l9 3M41.5 35.5l-9 3"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M26.5 52q3.5-2.4 7 0"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}
      <circle cx="18" cy="49" r="2.4" fill="var(--cv-masc-cheek)" opacity=".5" />
      <circle cx="42" cy="49" r="2.4" fill="var(--cv-masc-cheek)" opacity=".5" />
    </svg>
  );
}

/** Pip, the Tell me speech bubble; worried while its session waits on you. */
export function Pip(props: { readonly worried: boolean }) {
  const { worried } = props;
  return (
    <svg data-cv-masc="pip" viewBox="0 0 60 56" aria-hidden>
      <path
        d="M10 6h40a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H27l-10 9v-9h-7a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8Z"
        fill="var(--cv-pip-body)"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="22" r="2.6" fill={INK} />
      <circle cx="38" cy="22" r="2.6" fill={INK} />
      {worried ? (
        <>
          <path d="M17 16l6 2M43 16l-6 2" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path
            d="M25 32q5-3 10 0"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M24 29q6 6 12 0"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
      <circle cx="15" cy="28" r="2.4" fill="var(--cv-masc-cheek)" opacity=".45" />
      <circle cx="45" cy="28" r="2.4" fill="var(--cv-masc-cheek)" opacity=".45" />
    </svg>
  );
}
