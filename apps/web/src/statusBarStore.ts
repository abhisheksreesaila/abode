/**
 * What the status bar shows about the open thread but cannot derive itself:
 * the composer owns the model's display name and the thread detail (and so the
 * context window), and the status bar sits outside the chat column. The
 * composer publishes a snapshot; the bar reads it only for the same thread.
 * The pickers live in the composer too, so the bar asks for them by event.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";
import { create } from "zustand";

export interface StatusBarThreadInfo {
  /** `scopedThreadKey` of the thread the snapshot belongs to. */
  readonly threadKey: string;
  readonly modelLabel: string | null;
  /** 0-100, or null when the provider reports no context window. */
  readonly contextPercent: number | null;
}

/** The thread the chat view has open, drafts included. ChatView publishes it. */
export interface StatusBarActiveThread {
  readonly threadKey: string;
  readonly ref: ScopedThreadRef;
  readonly branch: string | null;
  readonly projectName: string | null;
  readonly hostLabel: string | null;
}

interface StatusBarStoreState {
  readonly active: StatusBarActiveThread | null;
  publishActive: (active: StatusBarActiveThread) => void;
  clearActive: (threadKey: string) => void;
  readonly info: StatusBarThreadInfo | null;
  publish: (info: StatusBarThreadInfo) => void;
  /** Drops the snapshot, but only if it is still this thread's. */
  clear: (threadKey: string) => void;
}

export const useStatusBarStore = create<StatusBarStoreState>()((set) => ({
  active: null,
  publishActive: (active) =>
    set((state) => {
      const current = state.active;
      return current &&
        current.threadKey === active.threadKey &&
        current.branch === active.branch &&
        current.projectName === active.projectName &&
        current.hostLabel === active.hostLabel
        ? state
        : { active };
    }),
  clearActive: (threadKey) =>
    set((state) => (state.active?.threadKey === threadKey ? { active: null } : state)),
  info: null,
  publish: (info) =>
    set((state) => {
      const current = state.info;
      return current &&
        current.threadKey === info.threadKey &&
        current.modelLabel === info.modelLabel &&
        current.contextPercent === info.contextPercent
        ? state
        : { info };
    }),
  clear: (threadKey) =>
    set((state) => (state.info?.threadKey === threadKey ? { info: null } : state)),
}));

export type StatusBarComposerControl = "model" | "workspace";

const COMPOSER_CONTROL_EVENT = "abode:open-composer-control";

/** Asks the open thread's composer to open one of its pickers. */
export function requestComposerControl(control: StatusBarComposerControl): void {
  window.dispatchEvent(
    new CustomEvent<StatusBarComposerControl>(COMPOSER_CONTROL_EVENT, { detail: control }),
  );
}

export function onComposerControlRequest(
  listener: (control: StatusBarComposerControl) => void,
): () => void {
  const handler = (event: Event) =>
    listener((event as CustomEvent<StatusBarComposerControl>).detail);
  window.addEventListener(COMPOSER_CONTROL_EVENT, handler);
  return () => window.removeEventListener(COMPOSER_CONTROL_EVENT, handler);
}
