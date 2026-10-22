import React from "react";
const base = import.meta.env.BASE_URL + "assets/";
const surface = (x) =>
  Math.round((267 + Math.sin(x / 66) * 13 + Math.sin(x / 29) * 7) / 4) * 4;
function Sprite({ id, x, y, w = 9, h = 11 }) {
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
export function AtlasLife({ phase }) {
  return (
    <g aria-hidden="true" pointerEvents="none" className="atlas-life">
      <image
        href={`${base}atlas/Sun.webp`}
        x="1055"
        y="48"
        width="46"
        height="46"
      />
      {[
        { x: 55, y: 70, w: 100 },
        { x: 470, y: 35, w: 82 },
        { x: 865, y: 85, w: 70 },
      ].map((c, i) => (
        <g
          className="atlas-cloud-drift"
          key={i}
          style={{
            animationDelay: `-${i * 9}s`,
            animationDuration: `${32 + i * 7}s`,
          }}
        >
          <image
            href={`${base}atlas/Cloud_${i % 2}.webp`}
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.w * 0.4}
          />
        </g>
      ))}
      {[
        { id: "Green_Slime", x: 332 },
        { id: "Pinky", x: 475 },
        { id: "Ice_Slime", x: 145 },
      ].map((m, i) => (
        <g key={m.id} transform={`translate(${m.x},${surface(m.x) - 8})`}>
          <g
            className="atlas-slime-hop"
            style={{ animationDelay: `-${i * 0.7}s` }}
          >
            <Sprite id={m.id} x={-4} y={-1} w={8} h={9} />
          </g>
        </g>
      ))}
      {[
        { id: "Harpy", x: 620, y: 79 },
        { id: "Hornet", x: 902, y: 355 },
        { id: "Cave_Bat", x: 360, y: 450 },
        { id: "Hellbat", x: 900, y: 690 },
        ...(phase > 0 ? [{ id: "Wyvern", x: 670, y: 60 }] : []),
      ].map((m, i) => (
        <g key={m.id} transform={`translate(${m.x},${m.y})`}>
          <g
            className="atlas-fauna-flight"
            style={{
              animationDelay: `-${i * 0.9}s`,
              animationDuration: `${6 + i}s`,
            }}
          >
            <Sprite
              {...m}
              x={0}
              y={0}
              w={m.id === "Wyvern" ? 30 : 11}
              h={m.id === "Wyvern" ? 12 : 10}
            />
          </g>
        </g>
      ))}
      <g className="atlas-weather atlas-snow">
        {Array.from({ length: 28 }, (_, i) => (
          <circle
            key={i}
            className="atlas-snowflake"
            cx={83 + ((i * 37) % 174)}
            cy={170 + ((i * 19) % 90)}
            r={i % 3 === 0 ? 0.9 : 0.5}
            fill="#e8f8ff"
            style={{
              animationDelay: `-${i * 0.37}s`,
              animationDuration: `${5 + (i % 4)}s`,
            }}
          />
        ))}
      </g>
      <g className="atlas-weather atlas-spores">
        {Array.from({ length: 16 }, (_, i) => (
          <circle
            key={i}
            className="atlas-firefly"
            cx={825 + ((i * 29) % 170)}
            cy={275 + ((i * 37) % 260)}
            r=".8"
            fill="#bcf285"
            style={{ animationDelay: `-${i * 0.7}s` }}
          />
        ))}
      </g>
      <g className="atlas-weather atlas-embers">
        {Array.from({ length: 20 }, (_, i) => (
          <rect
            key={i}
            className="atlas-lava-ember"
            x={40 + i * 57}
            y={720 + (i % 3) * 9}
            width="1.2"
            height="1.4"
            fill="#ffd588"
            style={{
              animationDelay: `-${i * 0.5}s`,
              animationDuration: `${3 + (i % 3)}s`,
            }}
          />
        ))}
      </g>
      <g
        className="atlas-water-shimmer"
        fill="none"
        stroke="#b1dcf0"
        strokeWidth=".7"
        opacity=".6"
      >
        <path d="M0 286h20m9 0h25m-40 4h16m1120-9h25m8 0h17m-36 5h26" />
      </g>
      {[
        [310, 400],
        [425, 460],
        [530, 530],
        [790, 420],
        [940, 480],
        [1070, 550],
        [195, 390],
        [200, 470],
        [190, 550],
      ].map(([x, y]) => (
        <circle
          key={x + "," + y}
          className="atlas-native-torch"
          cx={x + 1.7}
          cy={y + 1.2}
          r="2.4"
          fill="#ffce66"
          opacity=".18"
        />
      ))}
    </g>
  );
}
