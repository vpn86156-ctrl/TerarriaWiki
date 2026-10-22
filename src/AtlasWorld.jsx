import React, { memo } from "react";
import {
  atlasRegions,
  cameraFor,
  atlasResources,
  atlasCreatures,
  phaseVisible,
  atlasLandmarks,
} from "./atlasData";
import { atlasBuildings, atlasDiscoveries } from "./atlasAdventureData";
import { AtlasLife } from "./AtlasLife";
const base = import.meta.env.BASE_URL + "assets/";
function Pixel({ id, x, y, w = 20, h = 20 }) {
  return (
    <image
      href={`${base}${id}.webp`}
      x={x}
      y={y}
      width={w}
      height={h}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
const Terrain = memo(function Terrain({ phase }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x="-400" y="-300" width="2000" height="1600" fill="#75a5db" />
      <rect x="-400" y="285" width="2000" height="1000" fill="#294d75" />
      <rect x="-400" y="795" width="2000" height="600" fill="#241b23" />
      <image
        className="atlas-native-landscape"
        href={`${base}atlas/world-early.webp`}
        width="1200"
        height="800"
        style={{ imageRendering: "pixelated" }}
      />
      {phase > 0 && (
        <image
          className="atlas-hard-landscape"
          href={`${base}atlas/world-hard-overlay.webp`}
          x="440"
          y="340"
          width="156"
          height="196"
          style={{ imageRendering: "pixelated" }}
        />
      )}
      <AtlasLife phase={phase} />
    </g>
  );
});
export function AtlasWorld({
  selected,
  phase,
  onSelect,
  onPin,
  category,
  loot = [],
  onInspect,
  discoveries = [],
}) {
  const camera = cameraFor(selected);
  const hitOrder = [
    ...atlasRegions,
    {
      ...atlasRegions.find((r) => r.id === "ocean"),
      box: [1135, 220, 65, 200],
      east: true,
    },
  ].sort((a, b) => (a.id === "cavern" ? -1 : b.id === "cavern" ? 1 : 0));
  return (
    <svg
      className="atlas-world-svg"
      viewBox="0 0 1200 800"
      preserveAspectRatio={selected ? "xMidYMid slice" : "xMidYMid meet"}
      role="group"
      aria-label="Интерактивный разрез мира Terraria"
    >
      <title>Мир экспедиций: выбери биом для приближения</title>
      <g
        className="atlas-camera"
        data-scale={camera.scale}
        style={{
          transform: `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`,
        }}
      >
        <Terrain phase={phase} />
        {hitOrder.map((r) => {
          const [x, y, w, h] = r.box,
            cx = r.east ? 1153 : x + w / 2,
            cy =
              r.id === "hell"
                ? 735
                : r.id === "cavern"
                  ? 485
                  : r.id === "hallow"
                    ? 365
                    : r.id === "mushroom"
                      ? 610
                      : y + 30;
          return (
            <g
              key={r.id + (r.east ? "-east" : "")}
              className={`atlas-region ${selected?.id === r.id ? "selected" : ""} ${r.id === "hallow" && phase === 0 ? "dormant" : ""}`}
              role="button"
              tabIndex={selected ? -1 : 0}
              aria-label={`Приблизить: ${r.east ? "восточный океан" : r.name}`}
              onClick={() => onSelect(r.id, r.east ? "east" : "west")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(r.id, r.east ? "east" : "west");
                }
              }}
            >
              <rect
                className="atlas-region-hit"
                x={x}
                y={y}
                width={w}
                height={h}
                rx="3"
              />
              {!selected && (
                <g
                  className="atlas-map-label"
                  transform={`translate(${cx},${cy})`}
                >
                  <rect
                    x={-Math.max(42, r.name.length * 4.8)}
                    y="-13"
                    width={Math.max(84, r.name.length * 9.6)}
                    height="27"
                    rx="4"
                  />
                  <text textAnchor="middle" y="5">
                    {r.name}
                  </text>
                  {r.id === "hallow" && phase === 0 && (
                    <text
                      className="atlas-dormant-label"
                      textAnchor="middle"
                      y="30"
                    >
                      В ХАРДМОДЕ
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
        {atlasBuildings
          .filter((b) => !selected || selected.id === b.biome)
          .map((b) => (
            <g
              key={b.id}
              className="atlas-building-hit"
              role="button"
              tabIndex={0}
              aria-label={`Рассмотреть постройку: ${b.name}`}
              onClick={() => onInspect?.("building", b.id, b.biome)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onInspect?.("building", b.id, b.biome);
                }
              }}
            >
              <rect
                x={b.x - 8}
                y={b.y - (b.h + 5) * 4}
                width={(b.w + 4) * 4}
                height={(b.h + 5) * 4}
              />
              {selected && (
                <g
                  transform={`translate(${b.x + b.w * 2},${b.y - (b.h + 5) * 4 - 8}) scale(${1 / camera.scale})`}
                >
                  <rect x="-62" y="-14" width="124" height="28" rx="5" />
                  <text textAnchor="middle" y="5">
                    Осмотреть дом ↗
                  </text>
                </g>
              )}
            </g>
          ))}
        {selected &&
          atlasDiscoveries
            .filter((d) => d.biome === selected.id)
            .map((d) => (
              <g
                key={d.id}
                className={`atlas-discovery-hotspot ${discoveries.includes(d.id) ? "is-found" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Исследовать: ${discoveries.includes(d.id) ? d.name : d.clue}`}
                onClick={() => onInspect?.("discovery", d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onInspect?.("discovery", d.id);
                  }
                }}
              >
                <Pixel
                  id={
                    d.kind === "nymph" && !discoveries.includes(d.id)
                      ? "atlas/lost-girl"
                      : d.sprite
                  }
                  x={d.x - 4}
                  y={d.y - 10}
                  w={8}
                  h={10}
                />
                <g
                  transform={`translate(${d.x},${d.y - 15}) scale(${1 / camera.scale})`}
                >
                  <circle className="atlas-discovery-pulse" r="17" />
                  <text textAnchor="middle" y="5">
                    {discoveries.includes(d.id) ? "✓" : "?"}
                  </text>
                </g>
              </g>
            ))}
        {selected &&
          (() => {
            const ore = atlasResources[selected.id].filter((i) =>
                phaseVisible(i, phase),
              )[0],
              mob = atlasCreatures[selected.id].filter((i) =>
                phaseVisible(i, phase),
              )[0];
            return [
              ["resources", "Руды и ресурсы", ore?.sprite, ore?.name],
              ["creatures", "Мобы", mob?.id, mob?.name],
              ["loot", "Редкие находки", loot[0]?.id, loot[0]?.name],
            ].map(([type, label, sprite, name], i) => {
              if (!sprite) return null;
              const [px, py] = (selected.landmarks ||
                atlasLandmarks[selected.id])[i];
              return (
                <g key={type}>
                  <Pixel id={sprite} x={px - 7} y={py - 9} w={14} h={14} />
                  <g
                    className={`atlas-scene-pin ${category === type ? "active" : ""}`}
                    transform={`translate(${px},${py - 42 / camera.scale}) scale(${1 / camera.scale})`}
                    role="button"
                    tabIndex="0"
                    aria-label={`${label}: ${selected.name}`}
                    onClick={() => onPin(type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPin(type);
                      }
                    }}
                  >
                    <rect x="-95" y="-32" width="190" height="64" rx="8" />
                    <Pixel id={sprite} x={-83} y={-17} w={34} h={34} />
                    <text className="atlas-pin-category" x="-38" y="-6">
                      {label}
                    </text>
                    <text x="-38" y="13">
                      {name}
                    </text>
                    <circle cx="0" cy="42" r="4" />
                  </g>
                </g>
              );
            });
          })()}
      </g>
    </svg>
  );
}
