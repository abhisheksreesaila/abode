import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_CAST, MAX_PHOTO_CHARS, sanitizeCast } from "./bossConfig";

describe("sanitizeCast", () => {
  it("falls back to the defaults for junk", () => {
    expect(sanitizeCast(null)).toEqual(DEFAULT_CAST);
    expect(sanitizeCast({ look: { top: "tophat", skin: 3 }, bossName: "  " })).toEqual(
      DEFAULT_CAST,
    );
  });

  it("keeps valid choices and trims names", () => {
    const cast = sanitizeCast({
      enabled: false,
      look: { top: "beanie", eyes: "shades" },
      bossName: "  Abhi ",
      codexName: "Bolt",
    });
    expect(cast).toMatchObject({
      enabled: false,
      look: { top: "beanie", eyes: "shades", skin: DEFAULT_CAST.look.skin },
      bossName: "Abhi",
      claudeName: "Sunny",
      codexName: "Bolt",
    });
  });

  it("only keeps small image data URLs as the photo", () => {
    expect(sanitizeCast({ photo: "data:image/png;base64,AAAA" }).photo).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(sanitizeCast({ photo: "https://example.com/me.png" }).photo).toBeNull();
    expect(
      sanitizeCast({ photo: `data:image/png;base64,${"A".repeat(MAX_PHOTO_CHARS)}` }).photo,
    ).toBeNull();
  });
});
