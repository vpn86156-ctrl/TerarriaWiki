import { useReducedMotion } from "../state/useReducedMotion.js";
import React, { useState } from "react";
import attribution from "../../ATTRIBUTION.md?raw";
import { motion } from "framer-motion";
import { Check, Feather, Save, ArrowRight, Trash2 } from "lucide-react";
import { useStore } from "../state/Store.jsx";
import { chapters, roman } from "../data/chapters.js";
import { Sprite, Boss } from "../components/Sprite.jsx";
export function Note({ modal }) {
  const { state, update, back, setToast } = useStore(),
    original = state.diary.find((n) => n.id === modal.key),
    draft = original || modal.draft || {},
    [title, setTitle] = useState(draft.title || ""),
    [text, setText] = useState(draft.text || ""),
    [tag, setTag] = useState(draft.tag || "Заметка");
  const save = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const entry = {
      id:
        original?.id ||
        crypto.randomUUID?.() ||
        "note-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      title: title.trim(),
      text: text.trim(),
      tag,
      date: original?.date || new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    update((s) => ({
      diary: original
        ? s.diary.map((n) => (n.id === entry.id ? entry : n))
        : [entry, ...s.diary].slice(0, 500),
    }));
    setToast("Запись добавлена в дневник");
    back();
  };
  return (
    <form onSubmit={save} className="note-form">
      <p className="eyebrow">НА ПОЛЯХ ТВОЕЙ ЛЕТОПИСИ</p>
      <h2 id="modal-title" tabIndex={-1}>
        {original ? "Редактировать запись" : "Новая запись"}
      </h2>
      <label>
        Заголовок
        <input
          data-autofocus
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="О чём эта страница?"
        />
      </label>
      <label>
        Метка
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          {["Заметка", "Цель", "Открытие", "Постройка"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Текст
        <textarea
          rows={8}
          maxLength={10000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Маленькое открытие, большой план или просто хороший день…"
        />
      </label>
      <p className="data-note">
        Хранится локально на этом устройстве. Без аккаунта и облачной
        синхронизации.
      </p>
      <div className="modal-actions">
        <button className="button primary" type="submit">
          <Save size={17} />
          Сохранить запись
        </button>
        <button className="button" type="button" onClick={back}>
          Отмена
        </button>
      </div>
    </form>
  );
}
export function DeleteNote({ modal }) {
  const { state, update, close, setToast } = useStore(),
    entry = state.diary.find((n) => n.id === modal.key);
  return (
    <>
      <p className="eyebrow">ПОДТВЕРЖДЕНИЕ</p>
      <h2 id="modal-title" tabIndex={-1}>
        Удалить эту страницу?
      </h2>
      <p>
        Запись «{entry?.title}» исчезнет из этого приложения. Отменить удаление
        не получится.
      </p>
      <div className="modal-actions">
        <button
          className="button danger"
          onClick={() => {
            update((s) => ({
              diary: s.diary.filter((n) => n.id !== modal.key),
            }));
            close();
            setToast("Запись удалена");
          }}
        >
          <Trash2 size={16} />
          Удалить запись
        </button>
      </div>
    </>
  );
}
export function World() {
  const { state, update, back, setToast } = useStore(),
    [world, setWorld] = useState(state.world),
    [day, setDay] = useState(state.day),
    [mode, setMode] = useState(state.mode);
  return (
    <form
      className="note-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!world.trim()) return;
        update({
          world: world.trim(),
          day: Math.max(1, Math.min(99999, Math.floor(Number(day) || 1))),
          mode,
        });
        setToast("Мир обновлён");
        back();
      }}
    >
      <p className="eyebrow">ТВОЙ МАЛЕНЬКИЙ МИР</p>
      <h2 id="modal-title" tabIndex={-1}>
        У костра
      </h2>
      <label>
        Название мира
        <input
          required
          maxLength={48}
          value={world}
          onChange={(e) => setWorld(e.target.value)}
        />
      </label>
      <label>
        День
        <input
          type="number"
          required
          min="1"
          max="99999"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <label>
        Режим
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {["Обычный", "Эксперт", "Мастер", "Путешествие"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <p className="data-note">
        Это твои записи о мире. Сайт не читает и не изменяет файлы игры.
      </p>
      <button className="button primary" type="submit">
        <Save size={17} />
        Сохранить
      </button>
    </form>
  );
}
export function Story({ modal }) {
  const { state, open } = useStore(),
    c = chapters[modal.key];
  if (modal.key > state.completed)
    return (
      <h2 id="modal-title" tabIndex={-1}>
        История пока закрыта
      </h2>
    );
  return (
    <article className="reading">
      <div className="reading-guide">
        <Sprite
          icon="https://terraria.wiki.gg/images/Guide.png"
          name="Гид"
          size={58}
        />
        <div>
          <p className="eyebrow">АВТОРСКАЯ ИСТОРИЯ · ГИД</p>
          <span>
            Запись {Number(modal.key) + 1} · Глава {roman[modal.key]}
          </span>
        </div>
      </div>
      <h2 id="modal-title" tabIndex={-1}>
        {c.story}
      </h2>
      <div className="reading-illustration">
        <Boss boss={c.boss} name={c.goal} />
      </div>
      {c.body.split("\n\n").map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      <footer>
        Текст «TERRA Летопись». Художественный вымысел на основе мира Terraria,
        не официальный игровой диалог.
      </footer>
    </article>
  );
}
export function Chapter({ modal }) {
  const { state, update, patchModal } = useStore(),
    c = chapters[modal.key],
    current = modal.key === state.completed;
  return (
    <>
      <p className="eyebrow">ГЛАВА {roman[modal.key]}</p>
      <h2 id="modal-title" tabIndex={-1}>
        {c.title}
      </h2>
      <div className="chapter-modal-art">
        <Boss boss={c.boss} name={c.goal} />
      </div>
      <p>{c.text}</p>
      {current ? (
        <>
          <p>
            Ты завершил приготовления и победил{" "}
            {c.goal === "Глаз Ктулху" ? "Глаз Ктулху" : c.goal}? Подтверждение
            откроет следующую главу, историю и атмосферу мира.
          </p>
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={() => {
                if (state.completed !== modal.key) return;
                update({ completed: Math.min(11, state.completed + 1) });
                patchModal({ type: "seal" });
              }}
            >
              <Check size={17} />
              Подтвердить завершение
            </button>
          </div>
        </>
      ) : (
        <p className="available">Эта глава уже вписана в твою летопись.</p>
      )}
    </>
  );
}
export function Seal({ modal }) {
  const reduced = useReducedMotion(),
    { back, state } = useStore(),
    c = chapters[modal.key];
  return (
    <section className="seal-view">
      <motion.div
        className="seal-circle"
        initial={{
          scale: reduced ? 1 : 1.3,
          rotate: reduced ? 0 : -12,
          opacity: 0,
        }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.75 }}
      >
        <Boss boss={c.boss} name={c.goal} />
        <span>ГЛАВА {roman[modal.key]} · ПРОЙДЕНО</span>
      </motion.div>
      <p className="eyebrow">НОВАЯ СТРАНИЦА ТВОЕЙ ИСТОРИИ</p>
      <h2 id="modal-title" tabIndex={-1}>
        Мир запомнит этот день.
      </h2>
      <p>
        {state.completed < 11
          ? `Впереди — «${chapters[Math.min(state.completed, 10)].title}». Гид приготовил новую историю.`
          : "Все одиннадцать глав пройдены. Но в этом мире ещё столько неизведанного."}
      </p>
      <button className="button primary" onClick={back}>
        Продолжить путешествие <ArrowRight size={17} />
      </button>
    </section>
  );
}
export function AppInfo() {
  return (
    <>
      <p className="eyebrow">TERRA ЛЕТОПИСЬ · ANDROID</p>
      <h2 id="modal-title" tabIndex={-1}>
        Мир всегда рядом
      </h2>
      <p>
        Версия 0.1.0. Неофициальный автономный спутник Terraria. Встроенный
        интерфейс Android WebView, все данные, изображения и шрифты находятся
        внутри APK. Сервер и доступ к интернету не нужны.
      </p>
      <p>
        Прогресс, ресурсы и дневник сохраняются в приложении на этом устройстве.
        Удаление приложения или очистка его данных удалит записи. Облачной
        синхронизации нет.
      </p>
      <p>
        Для ссылок на wiki откроется внешний браузер. Приложение не запрашивает
        доступ к файлам игры, камере, контактам или геолокации.
      </p>
      <p>Нужен Android 8.0 или новее и обновлённый Android System WebView.</p>
    </>
  );
}
export function Credits() {
  return (
    <>
      <p className="eyebrow">ДАННЫЕ, АВТОРЫ И ЛИЦЕНЗИИ</p>
      <h2 id="modal-title" tabIndex={-1}>
        Источники и права
      </h2>
      <pre className="credits-text">{attribution}</pre>
    </>
  );
}
