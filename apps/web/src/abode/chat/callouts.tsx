import {
  CircleCheckIcon,
  CircleHelpIcon,
  InfoIcon,
  ListTodoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { abodeAlertValue } from "./calloutPlugin";
import type { CardKind } from "./cards";
import "./chat.css";
import "./chatFlag";

export { remarkAbodeCallouts } from "./calloutPlugin";

/**
 * How upstream's blockquote renderer draws abode's callouts (same shape as its GitHub-alert
 * table). The colors come from `chat.css` through the kind class, so every theme applies.
 */
const PRESENTATIONS: Record<CardKind, { label: string; Icon: LucideIcon }> = {
  question: { label: "Needs your answer", Icon: CircleHelpIcon },
  warning: { label: "Warning", Icon: TriangleAlertIcon },
  info: { label: "Info", Icon: InfoIcon },
  tickets: { label: "Tickets", Icon: ListTodoIcon },
  done: { label: "Done", Icon: CircleCheckIcon },
};

export const ABODE_ALERT_PRESENTATIONS: Record<
  string,
  { label: string; Icon: LucideIcon; borderClassName: string; titleClassName: string }
> = Object.fromEntries(
  Object.entries(PRESENTATIONS).map(([kind, presentation]) => [
    abodeAlertValue(kind as CardKind),
    {
      ...presentation,
      borderClassName: `abode-callout abode-callout-${kind}`,
      titleClassName: "abode-callout-title",
    },
  ]),
);
