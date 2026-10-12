/** The user's avatar, built from a few parts so it stays a tiny inline SVG. */

export const BOSS_SKINS = ["#ffd9bd", "#f1c19a", "#d9a074", "#a8714a", "#6e4a33"] as const;
export const BOSS_TOPS = ["crown", "cap", "hair", "beanie", "none"] as const;
export const BOSS_BROWS = ["big", "calm", "none"] as const;
export const BOSS_EYES = ["dots", "round", "shades"] as const;
export const BOSS_SCARVES = ["#f59e0b", "#4cc2ff", "#c586c0", "#4ec9b0", "#f48771"] as const;

export interface BossLook {
  readonly skin: (typeof BOSS_SKINS)[number];
  readonly top: (typeof BOSS_TOPS)[number];
  readonly brows: (typeof BOSS_BROWS)[number];
  readonly eyes: (typeof BOSS_EYES)[number];
  readonly scarf: (typeof BOSS_SCARVES)[number];
}

export interface CastSettings {
  /** abode chat on, or upstream's classic chat. */
  readonly enabled: boolean;
  readonly look: BossLook;
  /** A small data: URL the user uploaded, shown instead of the drawing. */
  readonly photo: string | null;
  readonly bossName: string;
  readonly claudeName: string;
  readonly codexName: string;
}

export const DEFAULT_CAST: CastSettings = {
  enabled: true,
  look: { skin: "#ffd9bd", top: "crown", brows: "big", eyes: "dots", scarf: "#f59e0b" },
  photo: null,
  bossName: "Boss",
  claudeName: "Sunny",
  codexName: "Pip",
};

/** Largest photo kept (it lives in local storage, which holds ~5MB per site). */
export const MAX_PHOTO_CHARS = 200_000;

function pick<T extends string>(options: ReadonlyArray<T>, value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function name(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 24) : fallback;
}

/** Whatever storage held, a valid CastSettings comes back. */
export function sanitizeCast(persisted: unknown): CastSettings {
  const record = typeof persisted === "object" && persisted !== null ? persisted : {};
  const value = record as Partial<Record<keyof CastSettings, unknown>>;
  const look = (typeof value.look === "object" && value.look !== null ? value.look : {}) as Partial<
    Record<keyof BossLook, unknown>
  >;
  const fallback = DEFAULT_CAST.look;
  const photo =
    typeof value.photo === "string" &&
    value.photo.startsWith("data:image/") &&
    value.photo.length <= MAX_PHOTO_CHARS
      ? value.photo
      : null;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_CAST.enabled,
    look: {
      skin: pick(BOSS_SKINS, look.skin, fallback.skin),
      top: pick(BOSS_TOPS, look.top, fallback.top),
      brows: pick(BOSS_BROWS, look.brows, fallback.brows),
      eyes: pick(BOSS_EYES, look.eyes, fallback.eyes),
      scarf: pick(BOSS_SCARVES, look.scarf, fallback.scarf),
    },
    photo,
    bossName: name(value.bossName, DEFAULT_CAST.bossName),
    claudeName: name(value.claudeName, DEFAULT_CAST.claudeName),
    codexName: name(value.codexName, DEFAULT_CAST.codexName),
  };
}
