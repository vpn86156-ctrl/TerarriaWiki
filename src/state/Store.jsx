import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { byKey } from "../data/index.js";
import { readSavedState, STORAGE_KEY } from "./persistence.js";
export { defaultState } from "./persistence.js";
const Context = createContext();
export function Store({ children }) {
  const [state, setState] = useState(() =>
      readSavedState({ getItem: (key) => localStorage.getItem(key) }),
    ),
    [storageWarning, setStorageWarning] = useState(""),
    [modals, setModals] = useState([]),
    [toast, setToast] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
