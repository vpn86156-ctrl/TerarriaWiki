import React, { memo, useId } from "react";
import {
  atlasRegions,
  cameraFor,
  atlasResources,
  atlasCreatures,
  phaseVisible,
  atlasLandmarks,
} from "./atlasData";
const base = import.meta.env.BASE_URL + "assets/";
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const surface = (x) =>
  Math.round((267 + Math.sin(x / 66) * 13 + Math.sin(x / 29) * 7) / 6) * 6;
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
const surfaceColors = (x) =>
  x < 80
    ? "#447b9b"
    : x < 265
      ? "#d7e9ee"
      : x < 515
        ? "#5d9751"
        : x < 685
          ? "#d2b477"
          : x < 810
            ? "#726397"
            : x < 1020
              ? "#397e49"
              : x < 1135
                ? "#a15463"
                : "#488ba8";
function Tree({ x, y, kind = "forest", height = 55 }) {
  const leaf =
    kind === "snow"
      ? "#d7e7ed"
      : kind === "jungle"
        ? "#397f3e"
        : kind === "evil"
          ? "#755d91"
          : kind === "crimson"
            ? "#ad5961"
            : "#5c944b";
  return (
    <g shapeRendering="crispEdges">
      <rect
        x={x - 3}
        y={y - height}
        width="7"
        height={height}
        fill={kind === "snow" ? "#6a787d" : "#68503a"}
      />
      <rect
        x={x - 1}
        y={y - height + 10}
        width="2"
        height={height - 10}
        fill="#94704a"
      />
      {kind === "snow" ? (
        [0, 1, 2].map((n) => (
          <path
            key={n}
            d={`M${x},${y - height - 18 + n * 15} l${20 + n * 6},26 h-${40 + n * 12}Z`}
            fill={leaf}
          />
        ))
      ) : (
        <>
          <rect
            x={x - 16}
            y={y - height - 19}
            width="35"
            height="12"
            fill={leaf}
          />
          <rect
            x={x - 27}
            y={y - height - 7}
            width="55"
            height="20"
            fill={leaf}
          />
          <rect
            x={x - 20}
            y={y - height + 13}
            width="40"
            height="9"
            fill={leaf}
          />
          <rect
            x={x - 18}
            y={y - height - 12}
            width="12"
            height="8"
            fill="#9aba5b"
            opacity=".5"
          />
          <rect
            x={x + 11}
            y={y - height + 3}
            width="11"
            height="8"
            fill="#203a35"
            opacity=".3"
          />
        </>
      )}
    </g>
  );
}
function House({ x, y, small = false }) {
  const w = small ? 38 : 58,
    h = small ? 28 : 42;
  return (
    <g shapeRendering="crispEdges">
      <rect
        x={x}
        y={y - h}
        width={w}
        height={h}
        fill="#6d533f"
        stroke="#392f2b"
        strokeWidth="5"
      />
      <path
        d={`M${x - 9},${y - h} l${w / 2 + 9},-23 l${w / 2 + 9},23Z`}
        fill="#8b5949"
      />
      <path
        d={`M${x - 9},${y - h} l${w / 2 + 9},-23 l${w / 2 + 9},23`}
        fill="none"
        stroke="#bc8363"
        strokeWidth="4"
      />
      <rect x={x + 8} y={y - h + 8} width="12" height="13" fill="#e4bd74" />
      <path
        d={`M${x + 14},${y - h + 8}v13 M${x + 8},${y - h + 14}h12`}
        stroke="#584531"
        strokeWidth="2"
      />
      <rect x={x + w - 15} y={y - 25} width="10" height="24" fill="#3c3131" />
      <rect x={x - 5} y={y} width={w + 10} height="5" fill="#8f8674" />
    </g>
  );
}
const Terrain = memo(function Terrain({ uid, phase }) {
  let edge = "M0,800 L0," + surface(0);
  for (let x = 0; x <= 1200; x += 6) edge += ` H${x} V${surface(x)}`;
  edge += " L1200,800Z";
  return (
    <g aria-hidden="true" shapeRendering="crispEdges">
      <defs>
        {[
          "stone",
          "grass",
          "mud",
          "wood",
          "jungle",
          "pearlstone",
          "mushroom",
        ].map((name) => (
          <pattern
            key={name}
            id={`${uid}-${name}`}
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <image href={`${base}farms/${name}.png`} width="16" height="16" />
          </pattern>
        ))}
        <linearGradient id={`${uid}-sky`} x2="0" y2="1">
          <stop stopColor="#334c71" />
          <stop offset="1" stopColor="#8ab0b8" />
        </linearGradient>
        <linearGradient id={`${uid}-lava`} x2="0" y2="1">
          <stop stopColor="#ffbf62" />
          <stop offset=".16" stopColor="#e57a3e" />
          <stop offset="1" stopColor="#782a30" />
        </linearGradient>
        <clipPath id={`${uid}-ground`}>
          <path d={edge} />
        </clipPath>
      </defs>
      <rect
        x="-400"
        y="-300"
        width="2000"
        height="1600"
        fill={`url(#${uid}-sky)`}
      />
      <rect x="-400" y="285" width="400" height="1000" fill="#35566b" />
      <rect x="1200" y="280" width="400" height="1000" fill="#35566b" />
      <circle cx="1080" cy="76" r="25" fill="#ecdb9b" />
      <circle cx="1080" cy="76" r="37" fill="#efdca9" opacity=".08" />
      {[0, 1, 2].map((n) => (
        <path
          key={n}
          d={`M0,${220 + n * 15} L${80 + n * 35},${90 + n * 39} ${180 + n * 28},210 ${290 + n * 30},${95 + n * 33} ${430 + n * 45},235 ${570 + n * 50},${110 + n * 20} ${770 + n * 27},230 ${940 + n * 35},${100 + n * 25} 1200,240 V310 H0Z`}
          fill={["#6c929e", "#638995", "#557783"][n]}
          opacity=".6"
        />
      ))}
      {[45, 255, 595, 925].map((x, i) => (
        <g key={x} fill="#d5e5e1" opacity=".65">
          <rect x={x} y={70 + (i % 2) * 40} width="80" height="13" />
          <rect x={x + 15} y={59 + (i % 2) * 40} width="43" height="12" />
        </g>
      ))}
      <g clipPath={`url(#${uid}-ground)`}>
        <rect y="220" width="1200" height="580" fill="#655043" />
        <rect y="365" width="1200" height="330" fill={`url(#${uid}-stone)`} />
        <rect y="365" width="1200" height="330" fill="#17202c" opacity=".6" />
        <rect x="80" y="245" width="185" height="350" fill="#6d98ac" />
        <rect
          x="80"
          y="245"
          width="185"
          height="350"
          fill="#a1c0cc"
          opacity=".27"
        />
        <rect x="515" y="235" width="170" height="325" fill="#9d7c50" />
        <rect x="685" y="235" width="125" height="250" fill="#514564" />
        <rect
          x="810"
          y="230"
          width="210"
          height="380"
          fill={`url(#${uid}-mud)`}
        />
        <rect
          x="810"
          y="230"
          width="210"
          height="380"
          fill="#1d4634"
          opacity=".67"
        />
        <rect x="1020" y="240" width="115" height="270" fill="#74424d" />
        {Array.from({ length: 105 }, (_, i) => {
          const x = 90 + Math.floor((noise(i + 2) * 1040) / 8) * 8,
            y = 315 + Math.floor((noise(i + 165) * 310) / 8) * 8,
            w = 16 + Math.floor(noise(i + 87) * 8) * 8,
            h = 8 + Math.floor(noise(i + 88) * 4) * 8;
          return (
            <path
              key={i}
              d={`M${x},${y}h${w}v8h8v${h}h-8v8h-${w}v-8h-8v-${h}h8Z`}
              fill={
                x > 810 && x < 1020
                  ? "#152d2b"
                  : x < 265
                    ? "#294552"
                    : "#1b242d"
              }
            />
          );
        })}
        <path
          d="M290,320 h52 v65 h96 v57 h-50 v62 h143 v64 h-68 v60"
          fill="none"
          stroke="#1b242d"
          strokeWidth="24"
        />
        <path
          d="M820,320 v50 h75 v65 h-42 v80 h88 v55"
          fill="none"
          stroke="#112d29"
          strokeWidth="22"
        />
        {Array.from({ length: 55 }, (_, i) => {
          const x = 100 + Math.floor((noise(i + 600) * 1020) / 8) * 8,
            y = 330 + Math.floor((noise(i + 720) * 285) / 8) * 8;
          return (
            <g
              key={i}
              fill={
                phase > 0 && i % 4 === 0
                  ? "#39a7a4"
                  : ["#bc925f", "#bec0b4", "#b9b072", "#77a5af"][i % 4]
              }
              opacity=".85"
            >
              {[0, 1, 2, 3].map((n) => (
                <rect
                  key={n}
                  x={x + (n % 3) * 5}
                  y={y + Math.floor(n / 2) * 5}
                  width="5"
                  height="5"
                />
              ))}
            </g>
          );
        })}
        <path
          d="M0,620 H1200"
          stroke="#85745a"
          strokeWidth="3"
          strokeDasharray="9 3"
        />
        <path d="M0,624 H1200" stroke="#24252b" strokeWidth="3" />
        <g fill="#35405b" stroke="#69768c" strokeWidth="5">
          <path d="M162,340 h64 v60 h-27 v44 h50 v65 h-57 v69 h-40 v-99 h30 v-62 h-20Z" />
        </g>
        {[360, 405, 455, 510, 555].map((y, i) => (
          <g key={y}>
            <rect
              x={i % 2 ? 195 : 163}
              y={y}
              width="26"
              height="8"
              fill="#172036"
            />
            <rect
              x={i % 2 ? 191 : 158}
              y={y - 5}
              width="3"
              height="7"
              fill="#ecb25c"
            />
          </g>
        ))}
        <g>
          <path
            d="M565,574 h42 v-16 h65 v-10 h79 v18 h38 v54 H565Z"
            fill="#122839"
          />
          {[590, 635, 690, 745].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y={598 - (i % 2) * 14}
                width="4"
                height="24"
                fill="#698db1"
              />
              <path
                d={`M${x - 14},${599 - (i % 2) * 14}v-8h6v-6h20v6h7v8Z`}
                fill="#599ce0"
              />
              <rect
                x={x - 5}
                y={585 - (i % 2) * 14}
                width="5"
                height="5"
                fill="#9cd5f7"
              />
            </g>
          ))}
        </g>
        {phase > 0 && (
          <g>
            <path
              d="M444,350 h142 v170 h-142Z"
              fill={`url(#${uid}-pearlstone)`}
              opacity=".5"
            />
            {[465, 492, 520, 553].map((x, i) => (
              <path
                key={x}
                d={`M${x},${420 + (i % 2) * 30} l-4,-13 5,-7 5,14Z`}
                fill="#d9b2eb"
              />
            ))}
          </g>
        )}
      </g>
      {Array.from({ length: 201 }, (_, i) => {
        const x = i * 6;
        return (
          <rect
            key={i}
            x={x}
            y={surface(x)}
            width="6"
            height={x < 80 || x > 1135 ? 26 : 6}
            fill={surfaceColors(x)}
          />
        );
      })}
      <path
        d="M0,284 h78 v68 H0Z M1136,280 h64 v70 h-64Z"
        fill="#427d9e"
        opacity=".85"
      />
      <path d="M0,284 h77 M1137,280h63" stroke="#91cbd3" strokeWidth="3" />
      {[
        105, 148, 193, 237, 284, 322, 368, 452, 485, 710, 757, 835, 874, 923,
        970, 1045, 1091,
      ].map((x, i) => (
        <Tree
          key={x}
          x={x}
          y={surface(x)}
          height={45 + Math.floor(noise(i) * 36)}
          kind={
            x < 265
              ? "snow"
              : x > 1020
                ? "crimson"
                : x > 810
                  ? "jungle"
                  : x > 685
                    ? "evil"
                    : "forest"
          }
        />
      ))}
      {[545, 581, 634, 659].map((x, i) => (
        <g key={x} fill="#64805b">
          <rect
            x={x}
            y={surface(x) - 32 - (i % 2) * 12}
            width="6"
            height={34 + (i % 2) * 12}
          />
          <path
            d={`M${x},${surface(x) - 15}h-9v-13h5v9h4 M${x + 6},${surface(x) - 19}h9v-14h-5v10h-4`}
            stroke="#64805b"
            strokeWidth="4"
            fill="none"
          />
        </g>
      ))}
      <House x={385} y={surface(385)} />
      <House x={191} y={surface(191)} small />
      <g fill="#63748e" stroke="#343f55" strokeWidth="4">
        <rect x="173" y="288" width="45" height="55" />
        <path d="M165,290v-24h9v10h10v-10h10v10h10v-10h10v24Z" />
      </g>
      {[435, 720].map((x, i) => (
        <g key={x}>
          <path
            d={`M${x},${115 + i * 30}h115v15h-12v10h-23v8h-36v-8h-25v-10h-19Z`}
            fill="#e0e9e2"
          />
          <path d={`M${x + 13},${112 + i * 30}h90v7h-90Z`} fill="#b4c5b0" />
          <House x={x + 39} y={110 + i * 30} small />
        </g>
      ))}
      <path d="M0,668 H1200 V800 H0Z" fill="#38272e" />
      <path
        d="M0,690 h92 v22 h83 v-13 h75 v36 h65 v-24 h95 v22 h69 v-21 h98 v31 h62 v-40 h88 v22 h99 v-11 h90 v29 h82 v-34 h102 v91 H0Z"
        fill={`url(#${uid}-lava)`}
      />
      {[85, 293, 470, 695, 880, 1060].map((x, i) => (
        <g key={x}>
          <path d={`M${x},665 v${27 + (i % 3) * 13} h18 V665`} fill="#5b4140" />
          <rect
            x={x - 12}
            y="698"
            width="55"
            height="40"
            fill="#392c32"
            stroke="#7f5a48"
            strokeWidth="4"
          />
          <rect x={x + 5} y="712" width="11" height="21" fill="#171d28" />
        </g>
      ))}
      {Object.entries(atlasLandmarks)
        .filter(([id]) => id !== "hallow" || phase > 0)
        .map(([id, points]) => (
          <Pixel
            key={id}
            id="Gold_Chest"
            x={points[2][0] - 7}
            y={points[2][1] - 10}
            w={14}
            h={12}
          />
        ))}
      <Pixel id="Gold_Chest" x={1153} y={380} w={14} h={12} />
      <rect x="-400" y="795" width="2000" height="500" fill="#3b2b30" />
      <Pixel id="Starfury" x={495} y={88} w={14} h={14} />
      <Pixel id="Green_Slime" x={340} y={surface(340) - 13} w={16} h={13} />
      <Pixel id="Hornet" x={910} y={390} w={19} h={22} />
      <Pixel id="Iron_Ore" x={362} y={450} w={12} h={12} />
      <Pixel id="Fire_Imp" x={560} y={673} w={16} h={24} />
      <Pixel id="Gold_Ore" x={470} y={560} w={12} h={12} />
      {phase > 0 && (
        <>
          <Pixel id="Chlorophyte_Ore" x={858} y={515} w={14} h={14} />
          <Pixel id="Chaos_Elemental" x={495} y={457} w={17} h={23} />
          <Pixel id="Wyvern" x={650} y={55} w={60} h={28} />
        </>
      )}
      {[308, 425, 530, 790, 940, 1070].map((x, i) => (
        <g key={x} className="atlas-torch">
          <rect
            x={x}
            y={398 + (i % 3) * 66}
            width="3"
            height="8"
            fill="#b28c62"
          />
          <rect
            x={x - 1}
            y={393 + (i % 3) * 66}
            width="5"
            height="5"
            fill="#eec16f"
          />
        </g>
      ))}
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
}) {
  const uid = "aw" + useId().replace(/[^a-zA-Z0-9]/g, ""),
    camera = cameraFor(selected);
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
        <Terrain uid={uid} phase={phase} />
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
