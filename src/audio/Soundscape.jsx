import { useEffect, useRef } from "react";
import { useSettings } from "../state/Settings.jsx";
import { useStore } from "../state/Store.jsx";
import { AudioEngine } from "./engine.js";
export default function Soundscape() {
  const { settings } = useSettings(),
    { state, modals } = useStore(),
    engine = useRef();
  useEffect(() => {
    const audio = new AudioEngine();
    engine.current = audio;
    const click = (e) => {
      if (
        e.isTrusted &&
        e.target.closest?.('button:not(:disabled),a[href],input[type="range"]')
      )
        audio.feedback();
    };
    const visibility = () =>
      document.hidden
        ? audio.suspend()
        : audio.configure(audio.options, audio.scene);
    const pause = () => audio.suspend();
    document.addEventListener("click", click);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("terra:app-paused", pause);
    const hide = () => audio.stop();
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("terra:app-paused", pause);
      window.removeEventListener("pagehide", hide);
      audio.destroy();
    };
  }, []);
  const reading = [...modals].reverse().find((m) => m.type === "story");
  const scene = Math.min(reading ? Number(reading.key) : state.completed, 10);
  useEffect(
    () => engine.current?.configure(settings, scene),
    [settings, scene],
  );
  return null;
}
