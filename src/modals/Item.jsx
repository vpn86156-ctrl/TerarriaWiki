import { acquisitionNotes } from "../data/acquisition-notes.js";
import PlaceImage from "../components/PlaceImage.jsx";
import { placeForSource } from "../data/places.js";
import React from "react";
import {
  Plus,
  Feather,
  ArrowLeft,
  GitBranch,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import { useStore } from "../state/Store.jsx";
import {
  data,
  byKey,
  recipeMap,
  itemName,
  stationName,
  description,
  categoryName,
  sourceName,
  conditionText,
  biomes,
  methods,
} from "../data/index.js";
import { Sprite, SharedSprite } from "../components/Sprite.jsx";
import { StarButton } from "../components/UI.jsx";
const sourcePhases = {
  "king-slime": 1,
  "eye-of-cthulhu": 2,
  "eater-of-worlds": 3,
  "brain-of-cthulhu": 3,
  "queen-bee": 4,
  skeletron: 5,
  "wall-of-flesh": 7,
  "the-destroyer": 7,
  "the-twins": 7,
  "skeletron-prime": 7,
  plantera: 8,
  golem: 9,
  "lunatic-cultist": 9,
  "moon-lord": 10,
};
function hiddenSource(s, state) {
  return (
    state.spoilers &&
    ((sourcePhases[s?.id] ?? sourcePhases[s?.slug] ?? 0) > state.completed ||
      (s?.hardmode && state.completed < 7))
  );
}
export default function Item({ modal }) {
  const { state, quantity, open, note, back, setToast } = useStore(),
    item = byKey.get(modal.key),
    drops = data.drops.items[item.key] || [],
    shops = data.shops[item.key] || [],
    variants = recipeMap.get(item.key) || [],
    shimmer = data.craft.shimmer.filter((r) => r.result === item.key),
    extract = data.extractinator.results.filter((r) => r.item === item.key);
  return (
    <>
      <div className="modal-item-head">
        <SharedSprite item={item} origin={modal.origin} modal />
        <div>
          <p className="eyebrow">ПРЕДМЕТ · {categoryName(item)}</p>
          <h2 tabIndex={-1} id="modal-title">
            {item.ru}
          </h2>
          <p className="english">
            {item.name}
            {!item.localized ? " · нет русской строки в источнике" : ""}
          </p>
        </div>
        <StarButton id={"item:" + item.key} />
      </div>
      {modal.ingredient && (
        <button className="text-button back-ingredient" onClick={back}>
          <ArrowLeft size={15} />
          Назад к ингредиенту
        </button>
      )}
      <p className="item-description">
        {description(item).replace(/\[c\/[a-fA-F0-9]+:([^\]]+)\]/g, "$1")}
      </p>
      <div className="item-facts">
        {item.damage > 0 && (
          <span>
            Урон: <b>{item.damage}</b>
          </span>
        )}
        {item.defense > 0 && (
          <span>
            Защита: <b>{item.defense}</b>
          </span>
        )}
        <span>
          Ячейка: <b>{item.stack}</b>
        </span>
        <span>{item.hardmode ? "Хардмод" : "До хардмода или позже"}</span>
        {item.version && <span>Добавлен в {item.version}</span>}
      </div>
      <div className="modal-actions">
        <button
          className="button primary"
          onClick={() => {
            quantity(item.key, (state.inventory[item.key] || 0) + 1);
            setToast("Добавлено в инвентарь: " + item.ru);
          }}
        >
          <Plus size={17} />В инвентарь{" "}
          <span className="quantity-badge">
            {state.inventory[item.key] || 0}
          </span>
        </button>
        <button
          className="button"
          onClick={() =>
            note(
              "Найти: " + item.ru,
              `Хочу получить ${item.ru} (${item.name}).\nИсточник: ${item.url}`,
              "Цель",
            )
          }
        >
          <Feather size={16} />В дневник
        </button>
      </div>
      <section className="sources-section">
        <h3>Как получить</h3>
        <div className="method-labels">
          {acquisitionNotes[item.key] && <span>Исследование мира</span>}
          {item.obtain.map((m) => (
            <span key={m}>{methods[m] || "Особый способ"}</span>
          ))}
        </div>
        {acquisitionNotes[item.key] &&
          (() => {
            const source = acquisitionNotes[item.key];
            return (
              <article className="source-card exploration-source">
                <div className="source-title">
                  <MapPin size={23} />
                  <div>
                    <b>{source.title}</b>
                    <small>{source.location}</small>
                  </div>
                </div>
                <PlaceImage
                  place={{
                    key: "shrine",
                    image: "shrine",
                    label: "Святилище зачарованного меча",
                  }}
                  large
                  returnTo={{
                    type: "item",
                    key: item.key,
                    origin: "item-place:" + item.key,
                  }}
                />
                <p>{source.text}</p>
                <p>{source.chance}</p>
                <aside className="source-clarification">
                  {source.clarification}
                </aside>
                <div className="source-references">
                  <a className="source-link" href={source.url}>
                    Официальная wiki: предмет ↗
                  </a>
                  <a className="source-link" href={source.biomeUrl}>
                    Святилище и условия появления ↗
                  </a>
                  <a className="source-link" href={source.enemyUrl}>
                    Одноимённый противник ↗
                  </a>
                </div>
              </article>
            );
          })()}
        {variants.length > 0 && (
          <div className="source-card">
            <div className="source-title">
              <GitBranch size={20} />
              <div>
                <b>Создать на станции</b>
                <small>
                  {variants.length}{" "}
                  {variants.length === 1 ? "рецепт" : "варианта"} ·{" "}
                  {variants[0].stations.map(stationName).join(" + ")}
                </small>
              </div>
            </div>
            <button
              className="button"
              onClick={() => open("recipe", item.key, "item-craft:" + item.key)}
            >
              Открыть рецепт и дерево <GitBranch size={15} />
            </button>
          </div>
        )}
        {drops.map((d, i) => {
          const source = data.drops.sources[d.source];
          if (hiddenSource({ ...source, id: d.source }, state))
            return (
              <div className="source-card" key={i}>
                <p>Источник будущей главы скрыт.</p>
              </div>
            );
          const mode =
              state.mode === "Эксперт"
                ? "expert"
                : state.mode === "Мастер"
                  ? "master"
                  : "normal",
            chance = d.chance?.[mode] ?? d.chance?.normal,
            quantity = d.quantities?.[mode] || d.quantity;
          return (
            <article className="source-card" key={i}>
              <PlaceImage
                place={placeForSource({ ...source, id: d.source })}
                returnTo={{
                  type: "item",
                  key: item.key,
                  origin: "item-place:" + item.key,
                }}
              />
              <div className="source-title">
                {source?.icon && (
                  <Sprite
                    icon={source.icon}
                    name={sourceName(source)}
                    size={38}
                  />
                )}
                <div>
                  <b>{sourceName(source)}</b>
                  <small>
                    {d.rate || chance != null
                      ? chance != null
                        ? `Шанс: ${chance}%`
                        : `Шанс: ${d.rate}`
                      : "Точный шанс не указан"}{" "}
                    · Количество: {quantity || "не указано"}
                  </small>
                </div>
              </div>
              {source?.biomes?.length > 0 && (
                <p className="source-detail">
                  <MapPin size={13} />
                  {source.biomes.map((b) => biomes[b] || b).join(", ")}
                </p>
              )}
              {d.conditions?.length > 0 && (
                <p className="source-detail">
                  Условия: {conditionText(d.conditions)}
                </p>
              )}
              {d.modes?.length > 0 && (
                <p className="source-detail">
                  Режимы:{" "}
                  {d.modes
                    .map(
                      (m) =>
                        ({
                          normal: "Обычный",
                          expert: "Эксперт",
                          master: "Мастер",
                          journey: "Путешествие",
                        })[m] || m,
                    )
                    .join(", ")}
                </p>
              )}
              {d.group && (
                <p className="source-detail">
                  Один из вариантов общего пула:{" "}
                  {data.drops.groups[d.group]?.pick ||
                    "награды распределяются по таблице источника"}
                  .
                </p>
              )}
              {d.note && (
                <details>
                  <summary>Примечание источника (EN)</summary>
                  <p className="english">{d.note}</p>
                </details>
              )}
              {source?.url && (
                <a className="source-link" href={source.url} rel="noreferrer">
                  Таблица источника на wiki ↗
                </a>
              )}
            </article>
          );
        })}
        {shops.map((s, i) => {
          const vendor = data.vendors.find((v) => v.id === s.vendor),
            npc = data.npcs.find((n) => n.name === vendor?.name),
            price = s.price?.formatted || s.price?.value;
          return (
            <article className="source-card" key={"shop" + i}>
              <div className="source-title">
                {vendor?.icon ? (
                  <Sprite
                    icon={vendor.icon}
                    name={npc?.ru || vendor.name}
                    size={38}
                  />
                ) : (
                  <ShoppingBag size={22} />
                )}
                <div>
                  <b>Купить: {npc?.ru || vendor?.name || s.vendor}</b>
                  <small>
                    Цена:{" "}
                    {typeof price === "string"
                      ? price
                          .replaceAll(" platinum", " платина")
                          .replaceAll(" gold", " золото")
                          .replaceAll(" silver", " серебро")
                          .replaceAll(" copper", " медь")
                      : JSON.stringify(s.price) || "уточни у продавца"}
                  </small>
                </div>
              </div>
              {s.conditions?.length > 0 && (
                <p className="source-detail">
                  Условия: {conditionText(s.conditions)}
                </p>
              )}
              {s.biomes?.length > 0 && (
                <p className="source-detail">
                  Биом: {s.biomes.map((b) => biomes[b] || b).join(", ")}
                </p>
              )}
              {s.text && (
                <details>
                  <summary>Полные условия источника (EN)</summary>
                  <p>{s.text}</p>
                </details>
              )}
              <a className="source-link" href={item.url} rel="noreferrer">
                Условия продажи на wiki ↗
              </a>
            </article>
          );
        })}
        {shimmer.map((r, i) => (
          <article className="source-card" key={"shimmer" + i}>
            <b>Превращение в Мерцании</b>
            <p>
              {itemName(r.item)} ×1 → {item.ru} ×{r.amount}
            </p>
            {r.requirement && (
              <p className="english">Условие из таблицы: {r.requirement}</p>
            )}
          </article>
        ))}
        {extract.map((r, i) => (
          <article className="source-card" key={"extract" + i}>
            <b>{methods[r.machine] || "Экстрактинатор"}</b>
            <p>
              Переработать: {r.inputs.map(itemName).join(" / ")}. Шанс{" "}
              {r.chance}; количество {r.quantity}.
            </p>
          </article>
        ))}
        {!drops.length &&
          !shops.length &&
          !variants.length &&
          !shimmer.length &&
          !extract.length && (
            <div className="source-card">
              <p>
                {item.unobtainable
                  ? "Предмет недоступен обычным игровым способом в указанной версии."
                  : "В снимке указаны способы получения, но нет точной таблицы источников для этого предмета."}{" "}
                Неуказанные условия, количество и шанс не предполагаются.
              </p>
              <p>{item.biomes.map((b) => biomes[b] || b).join(" · ")}</p>
            </div>
          )}
        <a className="button wiki-button" href={item.url} rel="noreferrer">
          Страница предмета на официальной wiki ↗
        </a>
      </section>
    </>
  );
}
