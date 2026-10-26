import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { byKey } from "../data/index.js";
export const defaultState = {
  world: "Зелёная долина",
  day: 12,
  mode: "Обычный",
  completed: 2,
  spoilers: true,
  inventory: {
    Wood: 120,
    StoneBlock: 80,
    Gel: 18,
    IronBar: 12,
    Torch: 24,
    IronOre: 36,
  },
  favorites: [],
  diary: [],
};
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem("terra:chronicle:v1") || "null");
    if (!s) return defaultState;
    return {
      ...defaultState,
      world:
        typeof s.world === "string" ? s.world.slice(0, 48) : defaultState.world,
      day: Number.isInteger(s.day) && s.day > 0 ? Math.min(s.day, 99999) : 12,
      mode: ["Обычный", "Эксперт", "Мастер", "Путешествие"].includes(s.mode)
        ? s.mode
        : "Обычный",
      completed: Number.isInteger(s.completed)
        ? Math.max(0, Math.min(11, s.completed))
        : 2,
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
const Context = createContext();
export function Store({ children }) {
  const [state, setState] = useState(restore),
    [storageWarning, setStorageWarning] = useState(""),
    [modals, setModals] = useState([]),
    [toast, setToast] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem("terra:chronicle:v1", JSON.stringify(state));
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Не удалось сохранить данные на устройстве. Изменения доступны только до закрытия приложения.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(id);
  }, [toast]);
  const update = useCallback(
    (patch) =>
      setState((s) => ({
        ...s,
        ...(typeof patch === "function" ? patch(s) : patch),
      })),
    [],
  );
  const favorite = (key) =>
    update((s) => ({
      favorites: s.favorites.includes(key)
        ? s.favorites.filter((k) => k !== key)
        : [...s.favorites, key],
    }));
  const quantity = (key, value) => {
    if (byKey.has(key))
      update((s) => ({
        inventory: {
          ...s.inventory,
          [key]: Math.max(0, Math.min(999999, Math.floor(Number(value) || 0))),
        },
      }));
  };
  const open = useCallback(
    (type, key, origin = "", extra = {}) =>
      setModals((m) => [
        ...m,
        { type, key, origin, focusTarget: document.activeElement, ...extra },
      ]),
    [],
  );
  const patchModal = (patch) =>
    setModals((m) =>
      m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)),
    );
  const restoreFocus = (target) =>
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  const back = () =>
    setModals((m) => {
      restoreFocus(m.at(-1)?.focusTarget);
      return m.slice(0, -1);
    });
  const close = () =>
    setModals((m) => {
      restoreFocus(m[0]?.focusTarget);
      return [];
    });
  const note = (title = "", text = "", tag = "Цель") =>
    open("note", null, "", { draft: { title, text, tag } });
  return (
    <Context.Provider
      value={{
        state,
        update,
        favorite,
        quantity,
        modals,
        open,
        patchModal,
        back,
        close,
        note,
        toast,
        setToast,
        storageWarning,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
