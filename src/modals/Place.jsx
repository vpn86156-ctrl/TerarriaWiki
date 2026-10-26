import React from "react";
import { MapPin } from "lucide-react";
import { placePanels } from "../data/places.js";
import { useStore } from "../state/Store.jsx";
export default function Place({ modal }) {
  const { back } = useStore();
  const place = placePanels[modal.key] || placePanels.underground;
  const fromItem = modal.fromItem;
  return (
    <>
      <p className="eyebrow">ГДЕ ИСКАТЬ · ОРИЕНТИР</p>
      <h2 id="modal-title" tabIndex={-1}>
        {place.label}
      </h2>
      <figure className="place-figure">
        <img
          src={`./images/places/${place.image}.webp`}
          alt={`Схема места: ${place.label}`}
        />
        <figcaption>
          <MapPin size={14} /> Ориентир: настоящий фон биома и игровой спрайт.
          Это не скриншот конкретного мира и не карта координат.
        </figcaption>
      </figure>
      <p>
        Ищи в этом биоме или помещении. Точные координаты не сохраняются:
        генерация мира случайна, поэтому отмечай найденное в дневнике. Сундуки и
        ящики могут быть в нескольких местах биома; ориентир показывает тип
        места, а не единственную точку.
      </p>
      {fromItem && (
        <button className="button" onClick={back}>
          Вернуться к предмету
        </button>
      )}
    </>
  );
}
