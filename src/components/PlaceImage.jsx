import React from "react";
import { MapPin } from "lucide-react";
import { useStore } from "../state/Store.jsx";
export default function PlaceImage({ place, large = false, returnTo }) {
  const { open } = useStore();
  if (!place) return null;
  return (
    <button
      type="button"
      className={"place-thumb" + (large ? " place-large" : "")}
      onClick={() =>
        open("place", place.key, undefined, { returnTo, fromItem: true })
      }
      aria-label={`Где искать: ${place.label}. Открыть схему места`}
    >
      <img src={`./images/places/${place.image}.webp`} alt="" loading="lazy" />
      <span>
        <MapPin size={13} /> {place.event ? "Событие: " : "Где: "}
        {place.label}
      </span>
      <small>Открыть ориентир</small>
    </button>
  );
}
