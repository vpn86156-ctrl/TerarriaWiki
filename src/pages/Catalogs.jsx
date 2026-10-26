import { Reveal } from "../components/Reveal.jsx";
import { useReducedMotion } from "../state/useReducedMotion.js";
import React, {
  useState,
  useMemo,
  useDeferredValue,
  useRef,
  useEffect,
} from "react";
import { motion } from "framer-motion";
import { Star, SlidersHorizontal, Check, RotateCcw } from "lucide-react";
import {
  data,
  items,
  byKey,
  recipeMap,
  filterCrafts,
  filterItems,
  categoryName,
  categories,
  stationName,
  availability,
  biomes,
  methods,
  classes,
  platforms,
  formatNumber,
} from "../data/index.js";
import { useStore } from "../state/Store.jsx";
import { SharedSprite } from "../components/Sprite.jsx";
import {
  PageTitle,
  SearchInput,
  Select,
  Pagination,
  StarButton,
  Empty,
} from "../components/UI.jsx";
import { chapters } from "../data/chapters.js";
export function ItemCard({
  item,
  kind = "item",
  prefix = "obtain",
  order = 0,
}) {
  const { state, open } = useStore(),
    reduced = useReducedMotion(),
    origin = prefix + ":" + item.key,
    variants = recipeMap.get(item.key) || [],
    ready = variants.some((r) => availability(r, state.inventory).enough);
  return (
    <Reveal
      className="item-card"
      layout={reduced ? false : "position"}
      data-item-key={item.key}
      as="article"
      order={order}
    >
      <StarButton id={"item:" + item.key} />
      <button
        className="card-open"
        onClick={() =>
          open(kind === "craft" ? "recipe" : "item", item.key, origin)
        }
        aria-label={`Открыть ${kind === "craft" ? "рецепт" : "предмет"}: ${item.ru}`}
      >
        <SharedSprite item={item} origin={origin} />
        <h3>{item.ru}</h3>
        <p>{categoryName(item)}</p>
        <span
          className={
            "card-foot " + (kind === "craft" && ready ? "available" : "")
          }
        >
          {kind === "craft" ? (
            ready ? (
              <>
                <Check size={13} />
                Ресурсы есть
              </>
            ) : (
              <>
                {variants.length > 1 ? `${variants.length} варианта` : "Рецепт"}{" "}
                · {stationName(variants[0]?.stations[0])}
              </>
            )
          ) : (
            item.obtain
              .map((o) => methods[o])
              .filter(Boolean)
              .slice(0, 2)
              .join(" · ") || "Особое получение"
          )}
        </span>
      </button>
    </Reveal>
  );
}
const initial = {
  query: "",
  category: "",
  station: "",
  method: "",
  biome: "",
  class: "",
  version: "",
  platform: "",
  stage: "",
  favorite: false,
  ready: false,
};
export function Catalog({ type = "craft" }) {
  const { state, update } = useStore(),
    [filters, setFilters] = useState(initial),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false),
    deferred = useDeferredValue(filters.query),
    top = useRef(),
    craft = type === "craft";
  const change = (key, value) => {
    setFilters((f) => ({
      ...f,
      [key]: value,
    }));
    setPage(1);
  };
  const result = useMemo(
    () =>
      craft
        ? filterCrafts(
            {
              ...filters,
              query: deferred,
            },
            state,
          )
        : filterItems(
            {
              ...filters,
              query: deferred,
            },
            state,
          ),
    [craft, filters, deferred, state],
  );
  // Diagnose excluded stages without exposing their names or pictures in spoiler-safe mode.
  const hiddenCount = useMemo(() => {
    if (!state.spoilers || !deferred.trim()) return 0;
    const unlocked = {
      ...state,
      spoilers: false,
    };
    const all = craft
      ? filterCrafts(
          {
            ...filters,
            query: deferred,
          },
          unlocked,
        )
      : filterItems(
          {
            ...filters,
            query: deferred,
          },
          unlocked,
        );
    return Math.max(0, all.length - result.length);
  }, [craft, filters, deferred, state, result.length]);
  const revealStages = () => {
    update({
      spoilers: false,
    });
    setPage(1);
  };
  const pageCount = Math.max(1, Math.ceil(result.length / 48)),
    actual = Math.min(page, pageCount),
    reduced = useReducedMotion();
  const goto = (p) => {
    setPage(p);
    top.current.scrollIntoView({
      block: "start",
      behavior: reduced ? "instant" : "smooth",
    });
  };
  return (
    <>
      <PageTitle
        eyebrow={
          craft ? "ЭНЦИКЛОПЕДИЯ СОЗДАНИЯ" : "КАЖДАЯ НАХОДКА — НАЧАЛО ИСТОРИИ"
        }
        title={craft ? "Все крафты" : "Как получить"}
        description={
          craft
            ? `${formatNumber(data.craft.recipes.length)} рецептов · ${formatNumber(recipeMap.size)} создаваемых предмета. От первого верстака до последних звёзд.`
            : `Все ${formatNumber(items.length)} предметов Terraria. Крафт, находки, магазины и редкий дроп.`
        }
      />
      <section className="filter-panel" ref={top} data-sticky={type}>
        <div className="filter-main">
          <SearchInput
            value={filters.query}
            onChange={(v) => change("query", v)}
            label={craft ? "Поиск крафтов" : "Поиск предметов"}
            placeholder={
              craft
                ? "Название, ингредиент или станция…"
                : "Название на русском или английском…"
            }
          />
          <button
            className={
              "button filter-toggle " + (filters.favorite ? "active" : "")
            }
            onClick={() => change("favorite", !filters.favorite)}
            aria-pressed={filters.favorite}
          >
            <Star size={16} />
            <span>Избранное</span>
          </button>
          {craft ? (
            <button
              className={
                "button filter-toggle " + (filters.ready ? "active" : "")
              }
              onClick={() => change("ready", !filters.ready)}
              aria-pressed={filters.ready}
            >
              <Check size={16} />
              <span>Ресурсы есть</span>
            </button>
          ) : (
            <button
              className={"button filter-toggle " + (more ? "active" : "")}
              onClick={() => setMore(!more)}
              aria-expanded={more}
            >
              <SlidersHorizontal size={16} />
              Фильтры
            </button>
          )}
        </div>
        <div className="filter-selects">
          <Select
            label="Категория"
            value={filters.category}
            onChange={(v) => change("category", v)}
            options={data.categories.map((c) => [
              c.id,
              categories[c.id] ||
                categoryName({
                  categories: [c.id],
                }),
            ])}
          />
          {craft ? (
            <Select
              label="Станция"
              value={filters.station}
              onChange={(v) => change("station", v)}
              options={Object.keys(data.craft.stations).map((s) => [
                s,
                stationName(s),
              ])}
            />
          ) : (
            <>
              <Select
                label="Способ получения"
                value={filters.method}
                onChange={(v) => change("method", v)}
                options={data.methods.map((m) => [
                  m.id,
                  methods[m.id] || "Особое получение",
                ])}
              />
              <Select
                label="Этап"
                value={filters.stage}
                onChange={(v) => change("stage", v)}
                options={chapters.map((c, i) => [
                  i + 1,
                  state.spoilers && i > state.completed
                    ? `Глава ${i + 1} · Неизвестная`
                    : c.title,
                ])}
              />
            </>
          )}
          {(filters.query ||
            Object.entries(filters).some(([k, v]) => k !== "query" && v)) && (
            <button
              className="text-button"
              onClick={() => {
                setFilters(initial);
                setPage(1);
              }}
            >
              <RotateCcw size={14} />
              Сбросить
            </button>
          )}
        </div>
        {!craft && more && (
          <div className="filter-selects extended">
            <Select
              label="Биом"
              value={filters.biome}
              onChange={(v) => change("biome", v)}
              options={data.biomes.map((b) => [b.id, biomes[b.id] || b.name])}
            />
            <Select
              label="Класс"
              value={filters.class}
              onChange={(v) => change("class", v)}
              options={Object.entries(classes)}
            />
            <Select
              label="Версия появления"
              value={filters.version}
              onChange={(v) => change("version", v)}
              options={[...new Set(items.map((i) => i.version).filter(Boolean))]
                .sort()
                .map((v) => [v, v])}
            />
            <Select
              label="Платформа"
              value={filters.platform}
              onChange={(v) => change("platform", v)}
              options={Object.entries(platforms)}
            />
          </div>
        )}
      </section>
      <div className="results-meta">
        <span>
          Найдено: <b>{formatNumber(result.length)}</b>
        </span>
        <span>
          {state.spoilers ? "До текущей главы" : "Все этапы"} · Terraria{" "}
          {data.meta.gameVersion}
        </span>
      </div>
      {hiddenCount > 0 && result.length > 0 && (
        <aside className="spoiler-notice" role="status">
          <span>
            Ещё {hiddenCount} совпадений скрыто режимом «Без спойлеров».
          </span>
          <button className="text-button" onClick={revealStages}>
            Показать все этапы
          </button>
        </aside>
      )}
      {result.length ? (
        <div className="item-grid">
          {result
            .slice((actual - 1) * 48, actual * 48)
            .map((item, cardIndex) => (
              <ItemCard
                order={cardIndex}
                key={item.key}
                item={item}
                kind={craft ? "craft" : "item"}
                prefix={craft ? "craft" : "obtain"}
              />
            ))}
        </div>
      ) : (
        <Empty
          title={
            hiddenCount ? "Совпадения скрыты режимом без спойлеров" : undefined
          }
          text={
            hiddenCount
              ? "Поиск нашёл предметы из будущих глав. Можно показать их, не меняя прогресс мира."
              : undefined
          }
          reset={() => {
            setFilters(initial);
            setPage(1);
          }}
        >
          {hiddenCount > 0 && (
            <button
              className="button primary reveal-stages"
              onClick={revealStages}
            >
              Показать все этапы
            </button>
          )}
        </Empty>
      )}
      <Pagination page={actual} total={result.length} onChange={goto} />
      <p className="data-note">
        Снимок wiki: {data.meta.dataVersion}.{" "}
        {items.filter((i) => !i.localized).length} названий без доступной
        русской локализации показаны на английском. Неизвестные шансы не
        подменяются оценками.
      </p>
    </>
  );
}
