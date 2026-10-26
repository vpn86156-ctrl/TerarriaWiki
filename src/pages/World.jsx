import { Reveal } from "../components/Reveal.jsx";
import { useReducedMotion } from "../state/useReducedMotion.js";
import React, { useEffect, useRef } from "react";
import {
  Check,
  Lock,
  ArrowRight,
  Feather,
  Plus,
  Trash2,
  Edit3,
} from "lucide-react";
import { chapters, roman } from "../data/chapters.js";
import { useStore } from "../state/Store.jsx";
import { ChapterArt, Sprite } from "../components/Sprite.jsx";
import { PageTitle, Empty, Eyebrow } from "../components/UI.jsx";
import { motion } from "framer-motion";
export function Path() {
  const { state, open } = useStore(),
    current = useRef(),
    reduced = useReducedMotion();
  useEffect(() => {
    current.current?.scrollIntoView({
      block: "center",
      behavior: reduced ? "instant" : "smooth",
    });
  }, [reduced]);
  return (
    <>
      <PageTitle
        eyebrow="НЕ СПЕШИ. КАЖДОМУ ОТКРЫТИЮ — СВОЁ ВРЕМЯ."
        title="Путь мира"
        description="Одиннадцать глав от первого костра до последнего испытания. Это рекомендуемый маршрут, не обязательный порядок игры."
      />
      <div className="path-progress panel">
        <span>Пройдено {state.completed} из 11 глав</span>
        <div className="progress-line">
          <motion.span
            initial={false}
            animate={{
              width: (state.completed / 11) * 100 + "%",
            }}
          />
        </div>
        <b>{Math.round((state.completed / 11) * 100)}%</b>
      </div>
      <div className="chapter-list">
        {chapters.map((c, i) => {
          const locked = i > state.completed,
            hidden = locked && state.spoilers;
          return (
            <Reveal
              key={i}
              ref={i === state.completed ? current : null}
              className={
                "chapter-card panel " +
                (i < state.completed
                  ? "done"
                  : i === state.completed
                    ? "current"
                    : "locked")
              }
              as="section"
              order={i}
              direction={i % 2 === 0 ? "left" : "right"}
            >
              <div className="chapter-number">
                {i < state.completed ? <Check size={23} /> : roman[i]}
              </div>
              <div className="chapter-art">
                {hidden ? <Lock size={38} /> : <ChapterArt chapter={c} />}
              </div>
              <div className="chapter-content">
                <Eyebrow>
                  ГЛАВА {roman[i]} ·{" "}
                  {i < state.completed
                    ? "ПРОЙДЕНО"
                    : i === state.completed
                      ? "ТЕКУЩАЯ"
                      : "ВПЕРЕДИ"}
                </Eyebrow>
                <h2>{hidden ? "Неизвестная глава" : c.title}</h2>
                <p>{hidden ? "Секреты этого этапа пока скрыты" : c.text}</p>
                {!hidden && (
                  <span className="chapter-goal">Цель: {c.goal}</span>
                )}
              </div>
              <button
                className={"button " + (i === state.completed ? "primary" : "")}
                disabled={locked}
                onClick={() => open("chapter", i)}
              >
                {i < state.completed
                  ? "Вспомнить"
                  : i === state.completed
                    ? "Завершить главу"
                    : "Закрыто"}
                {locked ? <Lock size={15} /> : <ArrowRight size={16} />}
              </button>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
export function Stories() {
  const { state, open } = useStore();
  return (
    <>
      <PageTitle
        eyebrow="ЗАПИСКИ, КОТОРЫЕ ПАХНУТ ДЫМОМ КОСТРА"
        title="Сюжет Terraria"
        description="Одиннадцать авторских историй от лица Гида. Художественный спутник прохождения, не официальный канон Re-Logic."
      />
      <div className="stories-grid">
        {chapters.map((c, i) => {
          const locked = i > state.completed;
          return (
            <Reveal
              className={"story-card panel " + (locked ? "locked" : "")}
              key={i}
              as="article"
              order={i}
              direction={i % 2 === 0 ? "left" : "right"}
            >
              <div className="story-image">
                {locked ? <Lock size={33} /> : <ChapterArt chapter={c} />}
              </div>
              <div>
                <Eyebrow>
                  ЗАПИСЬ {String(i + 1).padStart(2, "0")} · ГЛАВА {roman[i]}
                </Eyebrow>
                <h2>{locked ? "История ещё не рассказана" : c.story}</h2>
                <p>
                  {locked
                    ? "Продолжай путь, чтобы Гид доверил тебе следующую страницу."
                    : c.body.slice(0, 142) + "…"}
                </p>
                <button
                  className="text-button"
                  disabled={locked}
                  onClick={() => open("story", i)}
                >
                  {locked ? "Пока закрыто" : "Читать у костра"}
                  {locked ? <Lock size={15} /> : <ArrowRight size={16} />}
                </button>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
export function Diary() {
  const { state, open, note } = useStore();
  return (
    <>
      <PageTitle
        eyebrow="ЭТО УЖЕ ТВОЯ ИСТОРИЯ"
        title="Мой дневник"
        description="Открытия, планы и маленькие победы. Записи остаются на этом устройстве."
      >
        <button
          className="button primary"
          onClick={() => note("", "", "Заметка")}
        >
          <Plus size={18} />
          Новая запись
        </button>
      </PageTitle>
      {state.diary.length ? (
        <div className="diary-grid">
          {state.diary.map((n, cardIndex) => (
            <Reveal
              className="diary-card panel"
              key={n.id}
              as="article"
              order={cardIndex}
            >
              <div className="note-meta">
                <span className="tag">{n.tag}</span>
                <time>{new Date(n.date).toLocaleDateString("ru-RU")}</time>
              </div>
              <h2>{n.title}</h2>
              <p>{n.text}</p>
              <div className="note-actions">
                <button
                  className="text-button"
                  onClick={() => open("note", n.id)}
                >
                  <Edit3 size={15} />
                  Редактировать
                </button>
                <button
                  className="icon-button danger"
                  aria-label={"Удалить запись " + n.title}
                  onClick={() => open("delete-note", n.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Empty
          title="Чистая страница — тоже начало"
          text="Запиши первую находку или добавь цель со страницы предмета."
        />
      )}
    </>
  );
}
