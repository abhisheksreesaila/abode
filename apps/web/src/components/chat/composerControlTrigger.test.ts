import { describe, expect, it } from "vite-plus/test";

import { findComposerControlTrigger } from "./composerControlTrigger";

type Control = {
  name: string;
  inert?: boolean;
  visible?: boolean;
  closest: (selector: string) => unknown;
  checkVisibility: () => boolean;
};

function control(name: string, options: { inert?: boolean; visible?: boolean } = {}): Control {
  return {
    name,
    closest: (selector) => (selector === "[inert]" && options.inert ? {} : null),
    checkVisibility: () => options.visible ?? true,
  };
}

/** A form whose stack holds the controls of the outer rows and whose shell holds only the footer's. */
function formWith(stackControls: Control[], shellControls: Control[]) {
  const stack = { querySelectorAll: () => stackControls };
  const shell = { querySelectorAll: () => shellControls };
  return {
    closest: (selector: string) =>
      selector === "[data-chat-composer-stack]"
        ? stack
        : selector === '[data-slot="composer-shell"]'
          ? shell
          : null,
  };
}

describe("findComposerControlTrigger", () => {
  it("finds a control in the status row that lies outside the shell", () => {
    const access = control("access");
    const form = formWith([access], []);
    expect(findComposerControlTrigger(form, "composer.mode")).toBe(access);
  });

  it("skips controls that are inert or off screen", () => {
    const visible = control("visible");
    const form = formWith(
      [control("inert", { inert: true }), control("hidden", { visible: false }), visible],
      [],
    );
    expect(findComposerControlTrigger(form, "composer.branch")).toBe(visible);
  });

  it("falls back to the shell when there is no stack", () => {
    const inShell = control("shell");
    const form = {
      closest: (selector: string) =>
        selector === '[data-slot="composer-shell"]' ? { querySelectorAll: () => [inShell] } : null,
    };
    expect(findComposerControlTrigger(form, "composer.host")).toBe(inShell);
  });

  it("returns nothing without a form", () => {
    expect(findComposerControlTrigger(null, "composer.mode")).toBeUndefined();
  });
});
