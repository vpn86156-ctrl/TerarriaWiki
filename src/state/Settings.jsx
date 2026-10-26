import React, { createContext, useContext, useEffect, useState } from "react";
export const settingsDefaults = {
  sound: false,
  ambient: false,
  volume: 35,
  animations: true,
  particles: true,
};
const Context = createContext({
  settings: settingsDefaults,
  updateSettings: () => {},
  settingsWarning: "",
});
export function normalizeSettings(value = {}) {
  const s = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(settingsDefaults).map(([k, v]) => [
      k,
      k === "volume"
        ? Number.isFinite(s[k])
          ? Math.max(0, Math.min(100, Math.round(s[k])))
          : v
        : typeof s[k] === "boolean"
          ? s[k]
          : v,
    ]),
  );
}
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      return normalizeSettings(
        JSON.parse(localStorage.getItem("terra:settings:v1") || "null"),
      );
    } catch {
      return settingsDefaults;
    }
  });
  const [settingsWarning, setWarning] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem("terra:settings:v1", JSON.stringify(settings));
      setWarning("");
    } catch {
      setWarning(
        "Настройки не удалось сохранить. Они действуют до закрытия приложения.",
      );
    }
  }, [settings]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.documentElement.dataset.motion =
        !settings.animations || media.matches ? "reduced" : "full";
      document.documentElement.dataset.particles = settings.particles
        ? "on"
        : "off";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.animations, settings.particles]);
  return (
    <Context.Provider
      value={{
        settings,
        settingsWarning,
        updateSettings: (patch) =>
          setSettings((s) => normalizeSettings({ ...s, ...patch })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSettings = () => useContext(Context);
