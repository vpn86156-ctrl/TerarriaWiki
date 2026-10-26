import { byKey } from "../data/index.js";
export const STORAGE_KEY = "terra:chronicle:v1";
export const defaultState = {
  world: "Зелёная долина",
  day: 1,
  mode: "Обычный",
  completed: 0,
  progressReviewed: true,
  spoilers: true,
  inventory: {},
  favorites: [],
  diary: [],
};
export function readSavedState(storage) {
  try {
    const s = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!s || typeof s !== "object" || Array.isArray(s)) return defaultState;
    return {
      ...defaultState,
      world:
        typeof s.world === "string" ? s.world.slice(0, 48) : defaultState.world,
      day: Number.isInteger(s.day) && s.day > 0 ? Math.min(s.day, 99999) : 1,
      mode: ["Обычный", "Эксперт", "Мастер", "Путешествие"].includes(s.mode)
        ? s.mode
        : "Обычный",
      completed: Number.isInteger(s.completed)
        ? Math.max(0, Math.min(11, s.completed))
        : 0,
      progressReviewed:
        typeof s.progressReviewed === "boolean"
          ? s.progressReviewed
          : s.completed !== 2,
      spoilers: typeof s.spoilers === "boolean" ? s.spoilers : true,
      inventory: Object.fromEntries(
        Object.entries(s.inventory || {}).filter(
          ([k, v]) =>
            byKey.has(k) && Number.isSafeInteger(v) && v >= 0 && v <= 999999,
        ),
      ),
      favorites: Array.isArray(s.favorites)
        ? s.favorites.filter(
            (f) => typeof f === "string" && /^(item|npc):/.test(f),
          )
        : [],
      diary: Array.isArray(s.diary)
        ? s.diary
            .filter(
              (n) =>
                n &&
                typeof n.id === "string" &&
                typeof n.title === "string" &&
                typeof n.text === "string",
            )
            .slice(0, 500)
            .map((n) => ({
              ...n,
              title: n.title.slice(0, 120),
              text: n.text.slice(0, 10000),
            }))
        : [],
    };
  } catch {
    return defaultState;
  }
}
