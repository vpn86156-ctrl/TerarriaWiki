import React, { useMemo, useState } from "react";
import { Plus, Trash2, Check, Package } from "lucide-react";
import { useStore } from "../state/Store.jsx";
import {
  byKey,
  filterCrafts,
  norm,
  availability,
  chooseRecipe,
  recipeMap,
  groupName,
} from "../data/index.js";
import { Sprite } from "../components/Sprite.jsx";
import {
  PageTitle,
  SearchInput,
  Empty,
  Pagination,
} from "../components/UI.jsx";
import { ItemCard } from "./Catalogs.jsx";
export default function Inventory() {
  const { state, quantity, open } = useStore(),
    [query, setQuery] = useState(""),
    [ready, setReady] = useState(true),
    [page, setPage] = useState(1);
  const inv = Object.entries(state.inventory).filter(
    ([k, v]) =>
      v > 0 &&
      byKey.has(k) &&
      norm(byKey.get(k).ru + " " + byKey.get(k).name).includes(norm(query)),
  );
  const result = useMemo(
    () => filterCrafts({ query, ready }, state),
    [query, ready, state],
  );
  return (
    <>
      <PageTitle
        eyebrow="ВЕРСТАК НАЧИНАЕТСЯ С ТВОЕГО РЮКЗАКА"
        title="Из моих ресурсов"
        description="Добавляй находки — и смотри, что уже можно создать. Станция указывается отдельно: наличие ингредиентов не заменяет верстак."
      >
        <button
          className="button primary"
          onClick={() => open("search", null, "", { inventory: true })}
        >
          <Plus size={18} />
          Добавить предмет
        </button>
      </PageTitle>
      <SearchInput
        value={query}
        onChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
        label="Поиск по инвентарю и рецептам"
        placeholder="Поиск по инвентарю и рецептам…"
      />
      <div className="section-heading">
        <h2>Мой инвентарь</h2>
        <span>
          {Object.values(state.inventory).filter((v) => v > 0).length} видов
          ресурсов
        </span>
      </div>
      {inv.length ? (
        <div className="inventory-grid">
          {inv.map(([key, value]) => (
            <article className="inventory-row" key={key}>
              <button
                className="inventory-item"
                onClick={() => open("item", key, "inventory:" + key)}
              >
                <Sprite item={key} size={36} />
                <span>{byKey.get(key).ru}</span>
              </button>
              <label>
                <span className="sr-only">Количество: {byKey.get(key).ru}</span>
                <input
                  type="number"
                  min="0"
                  max="999999"
                  value={value}
                  onChange={(e) => quantity(key, e.target.value)}
                />
              </label>
              <button
                className="icon-button"
                aria-label={"Убрать " + byKey.get(key).ru}
                onClick={() => quantity(key, 0)}
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="В рюкзаке есть свободное место"
          text="Добавь предмет через поиск или измени запрос."
          reset={() => setQuery("")}
        />
      )}
      <div className="section-heading">
        <div>
          <p className="eyebrow">ПОРА СОЗДАВАТЬ</p>
          <h2>Твой следующий крафт</h2>
        </div>
        <button
          className={"button " + (ready ? "active" : "")}
          aria-pressed={ready}
          onClick={() => {
            setReady(!ready);
            setPage(1);
          }}
        >
          <Check size={16} />
          {ready ? "Только доступные" : "Все подходящие"}
        </button>
      </div>
      <div className="results-meta">
        <span>Найдено: {result.length}</span>
        <span>Группы материалов учитываются совместно</span>
      </div>
      {result.length ? (
        <div className="item-grid">
          {result.slice((page - 1) * 48, page * 48).map((item) => (
            <div key={item.key}>
              <ItemCard item={item} kind="craft" prefix="ready" />
              {!ready && (
                <p className="missing-line">
                  {availability(chooseRecipe(item.key, state), state.inventory)
                    .lines.filter((g) => g.missing > 0)
                    .slice(0, 2)
                    .map((g) => `Не хватает: ${groupName(g)} ×${g.missing}`)
                    .join(" · ") || "Все ингредиенты есть"}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Пока нечего собрать"
          text="Добавь материалы или отключи фильтр доступных рецептов."
        />
      )}
      <Pagination
        page={page}
        total={result.length}
        onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
      />
    </>
  );
}
