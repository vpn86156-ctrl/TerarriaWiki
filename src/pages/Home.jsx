import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Compass,
  Feather,
  Shuffle,
  ChevronRight,
  Settings2,
  Plus,
  Check,
} from "lucide-react";
import { useStore } from "../state/Store.jsx";
import { chapters, roman, quests } from "../data/chapters.js";
import { byKey, filterCrafts, recipeMap, formatNumber } from "../data/index.js";
import { Boss, Sprite } from "../components/Sprite.jsx";
import { Landscape } from "../components/Scenery.jsx";
import { Eyebrow, LinkButton } from "../components/UI.jsx";
import { ItemCard } from "./Catalogs.jsx";
export default function Home() {
  const { state, open, note } = useStore(),
    index = Math.min(state.completed, 10),
    chapter = chapters[index],
    progress = Math.round((state.completed / 11) * 100),
    [quest, setQuest] = useState(null);
  const ready = useMemo(() => filterCrafts({ ready: true }, state), [state]);
  const guide = {
    icon: "https://terraria.wiki.gg/images/Guide.png",
    ru: "Гид",
  };
  return (
    <>
      <div className="home-greeting">
        <div>
          <Eyebrow>ТВОЯ ИСТОРИЯ ЕЩЁ НЕ ЗАКОНЧЕНА</Eyebrow>
          <h1>
            С возвращением,
            <br />
            <span>путешественник.</span>
          </h1>
          <p>Мир ждёт. Куда отправимся сегодня?</p>
        </div>
        <button
          className="world-tag"
          onClick={() => open("world")}
          aria-label="Изменить мир и день"
        >
          <span className="world-indicator" />
          <span>
            <b>{state.world}</b>
            <small>
              День {state.day} · {state.mode} режим
            </small>
          </span>
          <Settings2 size={16} />
        </button>
      </div>
      <section className="world-hero">
        <Landscape index={index} />
        <div className="hero-orbit" />
        <div className="hero-copy">
          <span className="chapter-label">
            ГЛАВА {roman[index]} <span>•</span> ТВОЙ ТЕКУЩИЙ ЭТАП
          </span>
          <h2>{chapter.title}</h2>
          <p>{chapter.text}</p>
          <div className="hero-actions">
            <LinkButton to="path" className="primary">
              Продолжить путь
            </LinkButton>
            <span className="hero-progress">
              <b>{progress}%</b>
              <span>мира исследовано</span>
            </span>
          </div>
        </div>
        <div className="hero-boss">
          <Boss boss={chapter.boss} name={chapter.goal} />
          <span className="boss-label">
            СЛЕДУЮЩАЯ ЦЕЛЬ<b>{chapter.goal}</b>
          </span>
        </div>
        <div className="hero-bottom">
          <span>
            <i />
            Летопись твоего мира
          </span>
          <div className="progress-line">
            <span style={{ width: progress + "%" }} />
          </div>
          <span>{state.completed} / 11 глав</span>
        </div>
      </section>
      <div className="home-duo">
        <button
          className="guide-teaser panel"
          onClick={() => open("story", index)}
        >
          <div className="guide-portrait">
            <Sprite item={guide} size={56} />
            <i />
          </div>
          <div>
            <Eyebrow>
              У КОСТРА С ГИДОМ <span className="new-badge">НОВАЯ ИСТОРИЯ</span>
            </Eyebrow>
            <h3>{chapter.story}</h3>
            <p>«{chapter.body.split(".")[0]}…»</p>
          </div>
          <ArrowRight size={21} />
        </button>
        <section className="quest-card panel">
          <div className="quest-heading">
            <Compass size={20} />
            <span>Иногда лучший путь — случайный</span>
          </div>
          {quest ? (
            <>
              <h3>{quest.title}</h3>
              <p>{quest.text}</p>
              <div className="quest-actions">
                <button
                  className="text-button"
                  onClick={() => note(quest.title, quest.text, "Цель")}
                >
                  Записать в дневник <ArrowRight size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Другое случайное задание"
                  onClick={() =>
                    setQuest(
                      quests[
                        (quests.indexOf(quest) +
                          1 +
                          Math.floor(Math.random() * 4)) %
                          quests.length
                      ],
                    )
                  }
                >
                  <Shuffle size={17} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Не знаю, чем заняться</h3>
              <p>Пусть мир подскажет небольшое приключение.</p>
              <button
                className="text-button"
                onClick={() =>
                  setQuest(quests[Math.floor(Math.random() * quests.length)])
                }
              >
                Найти занятие <Shuffle size={15} />
              </button>
            </>
          )}
        </section>
      </div>
      <div className="quick-links">
        {[
          [
            "crafts",
            "WorkBench",
            "Все крафты",
            formatNumber(recipeMap.size) + " способов создать новое",
          ],
          [
            "obtain",
            "GoldChest",
            "Как получить",
            "От простых находок до редких трофеев",
          ],
          ["stories", "Book", "Истории Гида", "Мир, рассказанный у костра"],
        ].map(([to, key, title, sub]) => (
          <a href={"#/" + to} key={to}>
            <span className="quick-icon">
              <Sprite item={key} size={31} />
            </span>
            <span>
              <b>{title}</b>
              <small>{sub}</small>
            </span>
            <ChevronRight size={17} />
          </a>
        ))}
      </div>
      <section className="short-path panel">
        <div className="section-heading">
          <div>
            <Eyebrow>ОДНО ПРИКЛЮЧЕНИЕ. ОДИННАДЦАТЬ ГЛАВ.</Eyebrow>
            <h2>Твой путь через Террарию</h2>
          </div>
          <a href="#/path" className="text-button">
            Весь путь <ArrowRight size={16} />
          </a>
        </div>
        <div className="path-steps">
          {chapters.map((c, i) => (
            <button
              key={i}
              className={
                i < state.completed
                  ? "done"
                  : i === state.completed
                    ? "current"
                    : "locked"
              }
              disabled={i > state.completed}
              onClick={() => open("chapter", i)}
              aria-label={
                i > state.completed ? `Глава ${roman[i]}: неизвестная` : c.title
              }
            >
              <span>
                {i < state.completed ? <Check size={16} /> : roman[i]}
              </span>
              <small>
                {i === state.completed
                  ? "Ты здесь"
                  : i < state.completed
                    ? "Пройдено"
                    : "Неизвестно"}
              </small>
            </button>
          ))}
        </div>
      </section>
      <div className="section-heading resource-heading">
        <div>
          <Eyebrow>ЗАГЛЯНИ В СВОЙ РЮКЗАК</Eyebrow>
          <h2>Что собрать из ресурсов?</h2>
          <p>У тебя уже есть всё для маленького шага вперёд.</p>
        </div>
        <a href="#/inventory" className="text-button">
          Мои ресурсы <ArrowRight size={16} />
        </a>
      </div>
      <div className="resource-preview">
        {Object.entries(state.inventory)
          .filter(([k, v]) => v > 0 && byKey.has(k))
          .slice(0, 5)
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => open("item", k, "home-resource:" + k)}
            >
              <Sprite item={k} size={25} />
              <span>{byKey.get(k).ru}</span>
              <b>{v}</b>
            </button>
          ))}
      </div>
      <div className="home-recipes item-grid">
        {ready.slice(0, 4).map((i) => (
          <ItemCard item={i} key={i.key} kind="craft" prefix="home-craft" />
        ))}
      </div>
      {!ready.length && (
        <p className="data-note">
          Добавь материалы в инвентарь, чтобы увидеть доступные рецепты.
        </p>
      )}
      <div className="home-bottom">
        <section className="weekly panel">
          <img
            src="./images/treehouse.webp"
            alt="Авторская композиция дома на живом дереве из игровых ресурсов Terraria"
          />
          <div className="weekly-copy">
            <Eyebrow>ТВОЙ ЧЕЛЛЕНДЖ НЕДЕЛИ</Eyebrow>
            <h2>Дом, который растёт</h2>
            <p>
              Обживи живое дерево. Пусть одна из его ветвей станет чьим-то
              домом.
            </p>
            <button
              className="button"
              onClick={() =>
                note(
                  "Дом на живом дереве",
                  "Обустроить комнату в живом дереве: стены, свет, стол, стул и удобный вход. Это личная строительная цель, а не игровое событие.",
                  "Постройка",
                )
              }
            >
              Записать цель <Feather size={16} />
            </button>
          </div>
        </section>
        <section className="recent-notes panel">
          <div className="section-heading">
            <div>
              <Eyebrow>НА ПОЛЯХ ЛЕТОПИСИ</Eyebrow>
              <h2>Последние записи</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => note("", "", "Заметка")}
              aria-label="Новая запись"
            >
              <Plus size={20} />
            </button>
          </div>
          {state.diary.length ? (
            state.diary.slice(0, 3).map((n) => (
              <button
                className="recent-note"
                key={n.id}
                onClick={() => open("note", n.id)}
              >
                <small>
                  {new Date(n.date).toLocaleDateString("ru-RU")} · {n.tag}
                </small>
                <h3>{n.title}</h3>
                <p>{n.text}</p>
              </button>
            ))
          ) : (
            <div className="diary-empty">
              <Feather size={30} />
              <p>
                Здесь останутся твои открытия.
                <br />
                Первая страница ещё чиста.
              </p>
              <button
                className="text-button"
                onClick={() => note("", "", "Заметка")}
              >
                Начать свою историю <ArrowRight size={15} />
              </button>
            </div>
          )}
          <a href="#/diary" className="text-button">
            Открыть дневник <ArrowRight size={15} />
          </a>
        </section>
      </div>
    </>
  );
}
