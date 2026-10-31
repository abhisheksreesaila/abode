import {
  CircleCheckIcon,
  CircleHelpIcon,
  InfoIcon,
  ListTodoIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import type { PluggableList } from "unified";

import { abodeAlertValue, remarkAbodeCallouts } from "./calloutPlugin";
import type { CardKind } from "./cards";
import "./chat.css";
import "./chatFlag";

/** Appends abode's callout plugin to each of upstream's shared (cached) remark plugin lists. */
export function withAbodeCallouts<T extends Record<string, PluggableList>>(sets: T): T {
  return Object.fromEntries(
    Object.entries(sets).map(([key, list]) => [key, [...list, remarkAbodeCallouts]]),
  ) as T;
}

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
