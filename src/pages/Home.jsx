import BiomeBackdrop, { biomeNames } from "../components/BiomeBackdrop.jsx";
import { useSettings } from "../state/Settings.jsx";
import { Reveal } from "../components/Reveal.jsx";
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
import { ChapterArt, Sprite } from "../components/Sprite.jsx";
import { Landscape } from "../components/Scenery.jsx";
import { Eyebrow, LinkButton } from "../components/UI.jsx";
import { ItemCard } from "./Catalogs.jsx";
export default function Home() {
  const { settings } = useSettings();
  const { state, open, note } = useStore(),
    index = Math.min(state.completed, 10),
    chapter = chapters[index],
    progress = Math.round((state.completed / 11) * 100),
    [quest, setQuest] = useState(null);
  const ready = useMemo(
    () =>
      filterCrafts(
        {
          ready: true,
        },
        state,
      ),
    [state],
  );
  const guide = {
    icon: "https://terraria.wiki.gg/images/Guide.png",
    ru: "Гид",
  };
  return (
    <>
      <Reveal className="home-greeting" as="div" order={0}>
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
      </Reveal>
      <div className="world-status-strip">
        <span>
          <i />
          {biomeNames[index]}
        </span>
        <button onClick={() => open("settings")}>
          {settings.sound ? "Звук включён" : "Оживить мир звуком"}{" "}
          <Settings2 size={14} />
        </button>
      </div>
      <Reveal className="world-hero" as="section" order={1}>
        <BiomeBackdrop index={index} />
        <div className="hero-vignette" />
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
          <ChapterArt chapter={chapter} />
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
            <span
              style={{
                width: progress + "%",
              }}
            />
          </div>
          <span>{state.completed} / 11 глав</span>
        </div>
      </Reveal>
      <div className="home-duo">
        <Reveal
          className="guide-teaser panel"
          onClick={() => open("story", index)}
          as="button"
          order={2}
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
        </Reveal>
        <Reveal className="quest-card panel" as="section" order={3}>
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
        </Reveal>
      </div>
      <Reveal className="quick-links" as="div" order={0}>
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
      </Reveal>
      <Reveal className="expedition-board panel" as="section">
        <div className="section-heading">
          <div>
            <Eyebrow>МАЛЕНЬКИЕ ШАГИ — БОЛЬШОЕ ПРИКЛЮЧЕНИЕ</Eyebrow>
            <h2>Подготовься к дороге</h2>
          </div>
          <Compass size={24} />
        </div>
        <div className="expedition-cards">
          {[
            ["Torch", "Свет для пещер", "Не теряй дорогу в глубине."],
            [
              "WorkBench",
              "Место для идей",
              "От первых досок к новым рецептам.",
            ],
            ["WoodenSword", "Первое оружие", "Проверь, с чем выйдешь из дома."],
          ].map(([key, title, text]) => (
            <button key={key} onClick={() => open("item", key)}>
              <Sprite item={key} size={38} />
              <span>
                <b>{title}</b>
                <small>{text}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
        <p className="data-note">
          Это подсказки, а не выполненные задания. Прохождение мира отмечаешь
          только ты.
        </p>
      </Reveal>
      <Reveal className="short-path panel" as="section" order={1}>
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
      </Reveal>
      <div className="section-heading resource-heading">
        <div>
          <Eyebrow>ЗАГЛЯНИ В СВОЙ РЮКЗАК</Eyebrow>
          <h2>Что собрать из ресурсов?</h2>
          <p>
            {ready.length
              ? "У тебя уже есть всё для маленького шага вперёд."
              : "Добавь свои находки в рюкзак — покажем, что из них можно собрать."}
          </p>
        </div>
        <a href="#/inventory" className="text-button">
          Мои ресурсы <ArrowRight size={16} />
        </a>
      </div>
      <Reveal className="resource-preview" as="div" order={2}>
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
      </Reveal>
      <div className="home-recipes item-grid">
        {ready.slice(0, 4).map((i, cardIndex) => (
          <ItemCard
            order={cardIndex}
            item={i}
            key={i.key}
            kind="craft"
            prefix="home-craft"
          />
        ))}
      </div>
      {!ready.length && (
        <p className="data-note">
          Добавь материалы в инвентарь, чтобы увидеть доступные рецепты.
        </p>
      )}
      <div className="home-bottom">
        <Reveal className="weekly panel" as="section" order={3}>
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
        </Reveal>
        <Reveal className="recent-notes panel" as="section" order={0}>
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
        </Reveal>
      </div>
    </>
  );
}
