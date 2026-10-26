import { useSettings } from "../state/Settings.jsx";
import { useReducedMotion } from "../state/useReducedMotion.js";
import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { chapters } from "../data/chapters.js";
const ridges = [
  "0,430 110,380 230,400 360,300 520,350 700,280 870,390 1100,330 1440,410",
  "0,380 160,340 320,450 500,330 650,410 840,290 1080,370 1440,320",
  "0,430 100,350 240,390 380,310 560,410 750,350 920,260 1100,360 1440,300",
  "0,410 170,250 220,390 370,300 430,460 680,260 730,430 980,240 1050,420 1440,320",
  "0,400 200,360 320,280 450,310 580,240 790,310 900,270 1120,350 1440,280",
  "0,420 170,420 170,250 280,250 280,420 500,420 500,280 630,280 630,400 1440,380",
  "0,430 200,350 300,470 420,310 610,480 790,330 930,470 1100,360 1440,450",
  "0,420 180,210 320,360 500,160 680,380 850,190 1060,390 1240,180 1440,380",
  "0,450 180,400 280,300 430,330 600,250 760,370 930,290 1140,340 1440,250",
  "0,420 170,420 170,320 300,320 300,220 420,220 420,400 750,400 750,290 930,290 930,180 1060,180 1060,380 1440,350",
  "0,480 180,390 300,480 470,360 620,460 820,310 950,460 1140,350 1440,420",
];
export function Landscape({ index = 2 }) {
  const c = chapters[index];
  return (
    <svg
      viewBox="0 0 1440 600"
      className={"landscape landscape-" + c.scene}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={"land-" + index} x2="0" y2="1">
          <stop stopColor={c.color} stopOpacity=".28" />
          <stop offset="1" stopColor="#0c1416" />
        </linearGradient>
      </defs>
      <circle
        cx={1040 - index * 23}
        cy={130 + (index % 3) * 20}
        r={index === 10 ? 66 : 45}
        fill={c.color}
        opacity=".13"
      />
      <polygon
        points={"0,600 " + ridges[index] + " 1440,600"}
        fill={"url(#land-" + index + ")"}
      />
      {[...Array(13)].map((_, n) => {
        const x = n * 121 + ((index * 29) % 80),
          h = 90 + ((n * 37 + index * 19) % 150),
          y = 530;
        return index === 5 || index === 9 ? (
          <g key={n} fill="#101b22">
            <rect x={x} y={y - h} width={30 + (n % 3) * 12} height={h + 70} />
            <path d={`M${x - 8} ${y - h}h60v-12h-60Z`} />
          </g>
        ) : index === 6 ? (
          <path
            key={n}
            d={`M${x} 600l25 -${h} 22 ${h * 0.6} 22 -${h * 0.4} 20 ${h}`}
            fill="#241b27"
          />
        ) : index === 7 ? (
          <path
            key={n}
            d={`M${x} 600l${50 + (n % 2) * 20} -${h + 70} 80 ${h + 70}`}
            fill={n % 2 ? "#172637" : "#1d2f3c"}
          />
        ) : index === 10 ? (
          <g key={n} fill={c.color} opacity=".14">
            <path d={`M${x} ${y - h}l18 -30 18 30-18 45Z`} />
          </g>
        ) : (
          <g key={n} fill={index === 3 ? "#231c34" : "#0d1d20"}>
            <rect x={x + 25} y={y - h / 2} width="9" height={h} />
            {index === 4 || index === 8 ? (
              <>
                <ellipse cx={x + 27} cy={y - h + 50} rx={58} ry={35} />
                <path
                  d={`M${x + 2} ${y - h + 50}q10 70 0 105m55 -100q-15 50 0 90`}
                  stroke="#19302b"
                  strokeWidth="5"
                  fill="none"
                />
              </>
            ) : (
              <path d={`M${x + 30} ${y - h}l-46 85h23l-30 65h110l-30-65h22Z`} />
            )}
          </g>
        );
      })}
      <path
        d={`M0 548 Q300 ${490 - index * 3} 600 551 T1440 ${510 + index * 4} V600H0Z`}
        fill="#0b1519"
      />
    </svg>
  );
}
export function Scenery({ index }) {
  const { settings } = useSettings(),
    reduced = useReducedMotion(),
    ref = useRef();
  useEffect(() => {
    if (reduced || !matchMedia("(pointer:fine)").matches) return;
    let raf;
    const move = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        ref.current?.style.setProperty(
          "--px",
          (e.clientX / innerWidth - 0.5) * 9 + "px",
        );
        ref.current?.style.setProperty(
          "--py",
          (e.clientY / innerHeight - 0.5) * 5 + "px",
        );
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, [reduced]);
  const c = chapters[index];
  return (
    <div
      className={"world-atmosphere " + (reduced ? "reduced" : "")}
      ref={ref}
      aria-hidden="true"
      data-scenery={c.scene}
      data-weather={c.weather}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="scene-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.85 }}
        >
          <Landscape index={index} />
          <div
            className="scene-glow"
            style={{
              background: `radial-gradient(ellipse at 75% 30%,${c.color}19,transparent 60%)`,
            }}
          />
          {settings.particles &&
            [...Array(14)].map((_, i) => (
              <i
                className={"atmosphere-particle " + c.weather}
                key={i}
                style={{
                  left: ((i * 71) % 100) + "%",
                  top: ((i * 29) % 90) + "%",
                  animationDelay: -(i * 1.3) + "s",
                  animationDuration: 12 + (i % 5) * 3 + "s",
                }}
              />
            ))}
          <div className="scene-fog" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
