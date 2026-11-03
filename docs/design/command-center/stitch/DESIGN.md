# abode command center: design system (omxqua · Developer · Graphite · Light)

Material texture with Liquid motion. Opaque tonal surfaces, one soft shadow scale, pill-shaped controls, square mono status badges. Quiet, glanceable, trustworthy: a CI status page with an inbox on top.

## Colour (Light)

| Token     | Value   | Use                                          |
| --------- | ------- | -------------------------------------------- |
| surface-0 | #eeeef1 | page background (cool grey)                  |
| surface-1 | #ffffff | cards, table card                            |
| surface-2 | #ffffff | menus, popovers, sheets (with shadow-2)      |
| ink       | #0b0b0d | primary text, and the accent                 |
| ink-2     | #5b5b63 | secondary text, labels, mono source lines    |
| line      | #e3e3e8 | hairlines, table row dividers, badge borders |
| line-2    | #efeff2 | faint inner dividers                         |
| ok        | #137036 | running, passed, online                      |
| warn      | #8f5400 | needs you, waiting, near limit               |
| bad       | #c01f25 | failed, irreversible                         |
| info      | #0960b5 | informational, direction                     |

- **Accent is ink** (near-black). It fills the one loud button per card and the focus ring, nothing else.
- **States always carry the word**, never colour alone: a small dot plus the word ("running", "needs you", "idle", "failed").
- Hover / press / selected are state layers: ink at 8% / 12% / 16% over the surface, never a new colour.
- Text is at least 4.5:1 on its surface.
- **No gradients, no glass, no blur, no emoji icons.** Icons are thin line icons (Lucide style, 1.5px stroke).

## Type

- Words: **Geist**. Numbers, ids, ticket ids (A-040), paths, commands, times, percentages: **Geist Mono**.
- Base text 13.5px; small labels 11–12px; section titles 15–16px semibold; page title 22–24px semibold, tight tracking.
- Numbers in tables are tabular and right-aligned.

## Shape and spacing

- **Pill = tappable**: buttons, chips, segmented controls, tabs are fully rounded (999px).
- **Status = square mono badge**: radius 4px, 11px mono text, 1px hairline border, padding 4px 6px (e.g. `running`, `Irreversible`, `m4-pro`).
- Cards radius 12 (compact). Inputs 10. Menus 14, menu items 8. Concentric corners: inner radius = outer minus padding.
- Spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48.
- **Density compact**: 34px control height on desktop. On phone, touch targets are at least 48px.

## Depth (one shadow scale)

- Page = surface-0. Cards = surface-1 + shadow-1 (`0 1px 2px rgba(20,16,10,.06), 0 0 0 1px rgba(20,16,10,.045)`).
- Menus and popovers = surface-2 + shadow-2 (`0 6px 18px rgba(20,16,10,.10)`).
- Dialogs and bottom sheets = surface-3 + shadow-3 over a scrim.
- Depth comes from tone plus this one shadow, never borders stacked on borders.

## Components

- **Buttons**: pill. Filled = ink background, white text, shadow-1; one per card, with a specific verb ("Update tonight 03:00", never "Submit"). Tonal = white/surface-2 + shadow-1 or a light state tint. Text button = no fill. Inside panels, buttons are flat (no shadow).
- **Option pills** for decisions: a row of tonal pills, one-tap to pick; the recommended one may be filled.
- **Chips**: no outline; off = light ink tint, on = ink tint with ink text.
- **Tables**: hairline rows, sticky header with small ink-2 labels, mono right-aligned numbers, a row can expand in place. A long table scrolls inside its card.
- **Progress bar**: thin (4–6px) rounded track in line colour, fill in ink, label in mono ("7 of 12").
- **Meter**: labelled, thin bar with value in mono ("74% of window · resets 11:00").
- **Stat strip**: big mono numbers with small ink-2 labels beneath.
- **Show your work**: every card may end in a one-line mono source line in ink-2 above a faint hairline (the file, the command, the check).
- **Close button**: 32px circle with a line x icon; never a text glyph.
- States: loading = skeleton rows; empty = one line + the action; error = what happened + what to do.

## Layout and shells

- Content in a centred column, max 1120px wide, on the surface-0 page.
- Top bar: mark and name straight on the page (no pill around the brand), small trust badges, nothing loud.
- Phone: no hamburger for main navigation; cards stack; menus open as bottom sheets; buttons at least 48px tall; text inputs 16px.

## Motion (for handoff; static screens don't show it)

- Small things under the finger spring (press squash to 0.96 and back). Panels and pop-ups never bounce: they fade with a 12px slide over 280ms.
- An expanding row grows where it sits; the others make way.
- Live numbers update in place.
