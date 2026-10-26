import { useReducedMotion } from "../state/useReducedMotion.js";
import React, { useId } from "react";
import { motion } from "framer-motion";
import { data, byKey } from "../data/index.js";
import { useStore } from "../state/Store.jsx";
export function Sprite({ item, icon, name, size = 44, className = "" }) {
  const clipId = "sprite-crop-" + useId();
  const value = typeof item === "string" ? byKey.get(item) : item,
    source = icon || value?.icon,
    label = name || value?.ru || "Игровой спрайт";
  const coords = data.sprites.icons[source?.split("/").at(-1)];
  if (!coords)
    return (
      <span className="sprite-missing" role="img" aria-label={label}>
        Нет спрайта
      </span>
    );
  const [s, x, y, w, h] = coords,
    sheet = data.sprites.sheets[s];
  return (
    <svg
      className={"game-sprite " + className}
      viewBox={`${x} ${y} ${w} ${h}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{label}</title>
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <image
        clipPath={`url(#${clipId})`}
        href={"./images/" + sheet.file.split("/").at(-1)}
        width={sheet.w}
        height={sheet.h}
      />
    </svg>
  );
}
export function SharedSprite({ item, origin, modal = false, icon, name }) {
  const { modals } = useStore(),
    reduced = useReducedMotion();
  const active = modals.some((m) => m.origin === origin);
  const enabled =
    origin && !reduced && (modal ? modals.at(-1)?.origin === origin : !active);
  return (
    <motion.span
      className={"sprite-frame " + (modal ? "modal-sprite-frame" : "")}
      layout="position"
      layoutId={enabled ? "icon:" + origin : undefined}
      data-layout-id={enabled ? "icon:" + origin : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.75 }}
    >
      <Sprite item={item} icon={icon} name={name} size={modal ? 64 : 44} />
    </motion.span>
  );
}
export function Boss({ boss, name, className = "" }) {
  const reduced = useReducedMotion();
  return (
    <img
      className={"boss-sprite game-sprite " + className}
      src={`./images/${boss}.${reduced ? "png" : "gif"}`}
      alt={name || "Босс Terraria"}
      draggable="false"
    />
  );
}

// Early chapters are preparations, not boss encounters. Reuse the same semantic art everywhere.
export function ChapterArt({ chapter, size = 96 }) {
  return chapter.artItem ? (
    <Sprite item={chapter.artItem} size={size} className="chapter-item-art" />
  ) : (
    <Boss boss={chapter.boss} name={chapter.goal} />
  );
}
