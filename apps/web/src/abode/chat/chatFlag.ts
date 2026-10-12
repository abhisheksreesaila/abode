import { useCastStore } from "./cast/castStore";

/**
 * `html[data-abode-chat]` switches on abode's chat styling (reading style, avatars). It
 * follows the "abode chat" setting from the moment the chat code loads.
 */
function apply(enabled: boolean) {
  if (typeof document !== "undefined") {
    document.documentElement.toggleAttribute("data-abode-chat", enabled);
  }
}

apply(useCastStore.getState().enabled);
useCastStore.subscribe((state, previous) => {
  if (state.enabled !== previous.enabled) apply(state.enabled);
});
