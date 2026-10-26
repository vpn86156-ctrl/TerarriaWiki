import React, { useState } from "react";
import {
  Plus,
  GitBranch,
  Search as SearchIcon,
  ArrowRight,
} from "lucide-react";
import { useStore } from "../state/Store.jsx";
import { items, norm, allowed, recipeMap, data } from "../data/index.js";
import { chapters } from "../data/chapters.js";
import { SharedSprite } from "../components/Sprite.jsx";
export default function Search({ modal }) {
  const { state, open, close, quantity, setToast } = useStore(),
    [query, setQuery] = useState(""),
    q = norm(query),
    matches = items
      .filter(
        (i) =>
          allowed(i, state) &&
          (!q
            ? state.favorites.includes("item:" + i.key) ||
              [
                "Torch",
                "Wood",
                "StoneBlock",
                "IronBar",
                "WorkBench",
                "Campfire",
              ].includes(i.key)
            : norm(i.ru + " " + i.name).includes(q)),
      )
      .slice(0, 30),
    npcs =
      !modal.inventory && q
        ? data.npcs
            .filter((n) => norm(n.ru + " " + n.name).includes(q))
            .slice(0, 4)
        : [],
    stories =
      !modal.inventory && q
        ? chapters.filter(
            (c, i) =>
              i <= state.completed && norm(c.story + " " + c.title).includes(q),
          )
        : [],
    notes =
      !modal.inventory && q
        ? state.diary
            .filter((n) => norm(n.title + " " + n.text).includes(q))
            .slice(0, 4)
        : [];
  return (
    <>
      <p className="eyebrow">ТЕРРАРИЯ ВСЕГДА ЧУТЬ БОЛЬШЕ, ЧЕМ КАЖЕТСЯ</p>
      <h2 tabIndex={-1} id="modal-title">
        {modal.inventory ? "Добавить ресурсы" : "Найти в летописи"}
      </h2>
      <label className="search-field modal-search">
        <SearchIcon size={20} />
        <span className="sr-only">
          {modal.inventory
            ? "Поиск для добавления в инвентарь"
            : "Глобальный поиск"}
        </span>
        <input
          data-autofocus
          type="search"
          placeholder="Название предмета, жителя или истории…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>ESC</kbd>
      </label>
      <p className="data-note">
        {!q ? "Избранное и полезные предметы. " : ""}Поиск по русским и
        английским названиям. {state.spoilers ? "Будущие находки скрыты." : ""}
      </p>
      <div className="search-results">
        {matches.map((item) => {
          const origin = "search:" + item.key;
          return (
            <div className="search-result" key={item.key}>
              <button
                className="search-result-main"
                onClick={() =>
                  modal.inventory
                    ? (quantity(item.key, (state.inventory[item.key] || 0) + 1),
                      setToast("Добавлено: " + item.ru))
                    : open("item", item.key, origin)
                }
              >
                <SharedSprite item={item} origin={origin} />
                <span>
                  <b>{item.ru}</b>
                  <small>{item.name}</small>
                </span>
              </button>
              {modal.inventory ? (
                <button
                  className="button small"
                  aria-label={"Добавить " + item.ru}
                  onClick={() => {
                    quantity(item.key, (state.inventory[item.key] || 0) + 1);
                    setToast("Добавлено: " + item.ru);
                  }}
                >
                  <Plus size={15} /> {state.inventory[item.key] || 0}
                </button>
              ) : (
                recipeMap.has(item.key) && (
                  <button
                    className="icon-button"
                    aria-label={"Рецепт: " + item.ru}
                    onClick={() => open("recipe", item.key, origin)}
                  >
                    <GitBranch size={19} />
                  </button>
                )
              )}
            </div>
          );
        })}
        {npcs.map((n) => (
          <button
            className="search-plain-result"
            key={n.id}
            onClick={() => {
              close();
              location.hash = "/npcs?q=" + encodeURIComponent(n.ru);
            }}
          >
            <span>Житель · {n.ru}</span>
            <ArrowRight size={16} />
          </button>
        ))}
        {stories.map((c) => (
          <button
            className="search-plain-result"
            key={c.title}
            onClick={() => open("story", chapters.indexOf(c))}
          >
            <span>История · {c.story}</span>
            <ArrowRight size={16} />
          </button>
        ))}
        {notes.map((n) => (
          <button
            className="search-plain-result"
            key={n.id}
            onClick={() => open("note", n.id)}
          >
            <span>Дневник · {n.title}</span>
            <ArrowRight size={16} />
          </button>
        ))}
        {!matches.length &&
          !npcs.length &&
          !stories.length &&
          !notes.length && (
            <p className="empty-state">
              Ничего не найдено. Попробуй другое название.
            </p>
          )}
      </div>
    </>
  );
}
