import React from "react";
import { chapters } from "../data/chapters.js";
import { useSettings } from "../state/Settings.jsx";
import { useReducedMotion } from "../state/useReducedMotion.js";
export const biomeNames = [
  "У первого костра",
  "Лесные тропы",
  "Ночь над лесом",
  "Порча",
  "Джунгли",
  "Темница",
  "Преисподняя",
  "Снежные просторы",
  "Подземные джунгли",
  "Древний храм",
  "Последние звёзды",
];
export default function BiomeBackdrop({ index = 0, hidden = false }) {
  const { settings } = useSettings(),
    reduced = useReducedMotion(),
    c = chapters[index];
  return (
    <div
      className={"biome-backdrop " + (hidden ? "biome-hidden" : "")}
      data-biome={hidden ? "unknown" : c.scene}
      aria-hidden="true"
      style={
        hidden
          ? {}
          : {
              backgroundImage: `url("./images/biomes/${index === 10 ? "celestial" : c.scene}.webp")`,
            }
      }
    >
      {!hidden &&
        !reduced &&
        settings.particles &&
        Array.from({ length: 7 }, (_, i) => (
          <i
            className={"biome-speck " + (index === 6 ? "ember" : "")}
            key={i}
            style={{
              left: 9 + i * 13 + "%",
              top: ((19 + i * 23) % 85) + "%",
              animationDelay: -i * 1.7 + "s",
            }}
          />
        ))}
    </div>
  );
}
