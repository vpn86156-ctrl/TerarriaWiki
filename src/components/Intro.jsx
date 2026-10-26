import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Boss } from "./Sprite.jsx";
import { useReducedMotion } from "../state/useReducedMotion.js";
export default function Intro({ onEnter }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      className="intro intro-cinematic"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "tween", duration: reduced ? 0 : 0.4 }}
      aria-label="Добро пожаловать"
    >
      <div className="intro-universe" aria-hidden="true">
        <div className="intro-nebula" />
        <div className="intro-horizon" />
        {!reduced &&
          Array.from({ length: 16 }, (_, i) => (
            <i
              key={i}
              className="intro-mote"
              style={{
                left: ((i * 37) % 100) + "%",
                top: ((i * 53) % 100) + "%",
                animationDelay: -(i * 0.7) + "s",
                animationDuration: 8 + (i % 5) + "s",
              }}
            />
          ))}
      </div>
      {!reduced && (
        <motion.div
          className="intro-flash"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.48, 0] }}
          transition={{
            type: "tween",
            duration: 0.72,
            times: [0, 0.22, 1],
            delay: 0.12,
          }}
        />
      )}
      <div className="intro-content">
        <motion.div
          className="moon-arrival"
          initial={reduced ? false : { opacity: 0, scale: 0.9, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: "tween",
            duration: reduced ? 0 : 1.05,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="moon-aura" aria-hidden="true" />
          <div className="moon-orbit" aria-hidden="true" />
          <div className="moon-orbit moon-orbit-inner" aria-hidden="true" />
          <motion.div
            className="moon-figure"
            animate={
              reduced
                ? { y: 0, rotate: 0 }
                : { y: [0, -9, 0], rotate: [-0.6, 0.6, -0.6] }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 5.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <Boss boss="Moon_Lord" name="Лунный лорд" />
          </motion.div>
          <span className="moon-coordinate" aria-hidden="true">
            МИР ПРОБУЖДАЕТСЯ
          </span>
        </motion.div>
        <motion.div
          className="intro-title-block"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "tween",
            duration: reduced ? 0 : 0.65,
            delay: reduced ? 0 : 0.25,
          }}
        >
          <p className="eyebrow intro-overline">
            <span />
            ОТ ПЕРВОГО КОСТРА — К ПОСЛЕДНИМ ЗВЁЗДАМ
            <span />
          </p>
          <h1>
            TERRA<small>Л Е Т О П И С Ь</small>
          </h1>
          <p className="intro-description">
            Каждый мир заслуживает своей истории.
            <br />
            Эта — начинается с тебя.
          </p>
        </motion.div>
        <div className="intro-actions">
          <button
            className="button primary intro-enter"
            autoFocus
            onClick={onEnter}
          >
            Войти в мир <ArrowRight size={19} />
          </button>
          <button className="text-button intro-skip" onClick={onEnter}>
            Пропустить вступление
          </button>
        </div>
        <small className="intro-footnote">
          <Sparkles size={12} />
          Твой неофициальный спутник Terraria
        </small>
      </div>
    </motion.section>
  );
}
