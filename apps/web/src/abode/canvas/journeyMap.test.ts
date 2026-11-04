import { describe, expect, it } from "vite-plus/test";

import { goalLines, journeyLayout, robotSymbol } from "./journeyMap";

const plan = [
  { name: "Foundations", state: "done" },
  { name: "Canvas shell", state: "current" },
  { name: "Launch", state: "todo" },
] as const;

describe("journeyLayout", () => {
  const layout = journeyLayout(plan, "Ship the first public beta of the canvas");

  it("spaces the stickers evenly between the house and the goal", () => {
    expect(layout.stations.map((s) => [s.x, s.y, s.width, s.rotate])).toEqual([
      [220, 89, 150, -2],
      [476, 105, 150, 2],
      [732, 89, 150, -2],
    ]);
  });

  it("stands the robot above each sticker, between the house and the goal flag", () => {
    expect(layout.stands).toEqual([
      [38, 108],
      [220, 45],
      [476, 61],
      [732, 45],
      [930, 62],
    ]);
  });

  it("puts the robot on the current milestone and walks a share of the route", () => {
    expect(layout.cur).toBe(2);
    expect(layout.done).toBe(false);
    expect(layout.walked).toBe(2 / 4);
  });

  it("draws one curve per leg of the route", () => {
    expect(layout.path.startsWith("M 38 108 Q ")).toBe(true);
    expect(layout.path.match(/Q/g)).toHaveLength(4);
  });

  it("sends the robot to the goal once every milestone is done", () => {
    const finished = journeyLayout(
      [
        { name: "A", state: "done" },
        { name: "B", state: "done" },
      ],
      undefined,
    );
    expect(finished.done).toBe(true);
    expect(finished.cur).toBe(3);
  });

  it("shortens a long name to fit its sticker", () => {
    const crowded = journeyLayout(
      Array.from({ length: 8 }, (_, i) => ({
        name: i === 0 ? "A very long milestone name" : `M${i}`,
        state: "todo" as const,
      })),
      undefined,
    );
    expect(crowded.stations[0]!.width).toBe(70);
    expect(crowded.stations[0]!.label).toBe("A very …");
  });
});

describe("goalLines", () => {
  it("wraps the goal at about 20 characters, three lines at most", () => {
    expect(goalLines("Ship the first public beta of the canvas")).toEqual([
      "Ship the first",
      "public beta of the",
      "canvas",
    ]);
  });
  it("is empty without a goal", () => {
    expect(goalLines(undefined)).toEqual([]);
  });
});

describe("robotSymbol", () => {
  const session = (
    status: "blocked" | "waiting on you" | null,
    mode: "auto" | "grill" | "jam",
  ) => ({
    status,
    mode,
  });
  it("is a star at the goal", () => {
    expect(robotSymbol({ done: true, sessions: [session("blocked", "auto")] })).toBe("★");
  });
  it("lets a blocked session outrank asking and jamming", () => {
    expect(
      robotSymbol({
        done: false,
        sessions: [session(null, "jam"), session(null, "grill"), session("blocked", "auto")],
      }),
    ).toBe("!");
  });
  it("asks for a Grill me session, jams for Jam, and waits with ? when the user is needed", () => {
    expect(robotSymbol({ done: false, sessions: [session(null, "grill")] })).toBe("?");
    expect(robotSymbol({ done: false, sessions: [session(null, "jam")] })).toBe("♪");
    expect(robotSymbol({ done: false, sessions: [session("waiting on you", "auto")] })).toBe("?");
  });
  it("works (…) on a plain running session and sleeps (z) with none", () => {
    expect(robotSymbol({ done: false, sessions: [session(null, "auto")] })).toBe("…");
    expect(robotSymbol({ done: false, sessions: [] })).toBe("z");
  });
});
