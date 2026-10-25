import { describe, expect, it } from "vite-plus/test";

import { searchSettings } from "../../components/settings/settingsSearch";

describe("settings search finds abode's settings", () => {
  it.each([
    ["voice", "voice"],
    ["dictation", "voice"],
    ["hold-to-talk", "voice"],
    ["abode chat", "abode-chat"],
    ["calm", "abode-chat"],
    ["avatars", "abode-chat"],
  ])("%s opens the %s section in General", (query, id) => {
    expect(searchSettings(query)[0]).toMatchObject({ id, to: "/settings/general" });
  });
});
