import { useSyncExternalStore } from "react";
const media = window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (notify) => {
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
// Reactively follow system accessibility changes, including while the Android app is open.
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => media.matches,
    () => true,
  );
}
