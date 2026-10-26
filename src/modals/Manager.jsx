import { useReducedMotion } from "../state/useReducedMotion.js";
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, ArrowLeft } from "lucide-react";
import { useStore } from "../state/Store.jsx";
import { chapters } from "../data/chapters.js";
import Settings from "./Settings.jsx";
import Recipe from "./Recipe.jsx";
import Item from "./Item.jsx";
import Search from "./Search.jsx";
import {
  Note,
  World,
  ResetProgress,
  DeleteNote,
  Story,
  Chapter,
  Seal,
  AppInfo,
  Credits,
} from "./Misc.jsx";
const bodies = {
  settings: Settings,
  recipe: Recipe,
  item: Item,
  search: Search,
  note: Note,
  world: World,
  "reset-progress": ResetProgress,
  "delete-note": DeleteNote,
  story: Story,
  chapter: Chapter,
  seal: Seal,
  "app-info": AppInfo,
  credits: Credits,
};
export default function Manager() {
  const { modals, close, back } = useStore(),
    ref = useRef(),
    content = useRef(),
    modal = modals.at(-1),
    reduced = useReducedMotion();
  useEffect(() => {
    if (modal) {
      if (!ref.current.open) ref.current.showModal();
      ref.current.scrollTop = 0;
      const id = requestAnimationFrame(() => {
        (
          content.current?.querySelector("[data-autofocus]") ||
          content.current?.querySelector("#modal-title")
        )?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(id);
    } else if (ref.current?.open) ref.current.close();
  }, [modal?.type, modal?.key, modals.length]);
  useEffect(() => {
    if (!modal) return;
    const y = window.scrollY;
    const prior = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => {
      document.body.style.overflowY = prior;
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }, [!!modal]);
  const Body = modal && bodies[modal.type];
  return (
    <dialog
      className={"modal " + (modal?.type === "search" ? "search-dialog" : "")}
      ref={ref}
      data-reader-biome={
        modal?.type === "story" ? chapters[modal.key]?.scene : undefined
      }
      style={
        modal?.type === "story"
          ? {
              background: `linear-gradient(145deg,${["#243a30", "#18362d", "#21283d", "#2d2039", "#18382c", "#1d2c3f", "#401f20", "#24394c", "#163528", "#3b3022", "#142c39"][modal.key] || "#223139"},#111f28)`,
            }
          : undefined
      }
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        back();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="modal-toolbar">
        {modals.length > 1 ? (
          <button className="text-button" onClick={back}>
            <ArrowLeft size={16} />
            Назад
          </button>
        ) : (
          <span className="modal-brand">TERRA / WIKI</span>
        )}
        <button
          className="icon-button"
          onClick={close}
          aria-label="Закрыть окно"
        >
          <X size={21} />
        </button>
      </div>
      {Body && (
        <motion.div
          className="modal-content"
          ref={content}
          key={modal.type + ":" + modal.key}
          initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Body modal={modal} />
        </motion.div>
      )}
    </dialog>
  );
}
