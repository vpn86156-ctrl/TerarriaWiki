import { useSettings } from "./Settings.jsx";
import { useSyncExternalStore } from "react";
const media = window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (notify) => {
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
// Reactively follow system accessibility changes, including while the Android app is open.
export function useReducedMotion() {
  const { settings } = useSettings();
  const system = useSyncExternalStore(
    subscribe,
    () => media.matches,
    () => true,
  );
  return system || !settings.animations;
}
