import React from "react";
import { GitBranch, List, Check, Package, ArrowUpRight } from "lucide-react";
import { useStore } from "../state/Store.jsx";
import {
  byKey,
  recipeMap,
  chooseRecipe,
  itemName,
  stationName,
  availability,
  groupName,
  categoryName,
  recipePhase,
} from "../data/index.js";
import { SharedSprite, Sprite } from "../components/Sprite.jsx";
import { StarButton } from "../components/UI.jsx";
import { TreeNode } from "../components/RecipeTree.jsx";
export default function Recipe({ modal }) {
  const { state, open, patchModal } = useStore(),
    item = byKey.get(modal.key),
    all = recipeMap.get(item.key) || [],
    variants = all.filter(
      (r) => !state.spoilers || recipePhase(r) <= state.completed,
    ),
    recipe =
      variants.find((r) => r.id === modal.variant) ||
      chooseRecipe(item.key, state) ||
      all[0],
    wanted = modal.wanted || recipe.amount,
    batches = Math.ceil(wanted / recipe.amount),
    status = availability(recipe, state.inventory, batches),
    tree = modal.view === "tree";
  return (
    <>
      <div className="modal-item-head">
        <SharedSprite item={item} origin={modal.origin} modal />
        <div>
          <p className="eyebrow">РЕЦЕПТ · {categoryName(item)}</p>
          <h2 tabIndex={-1} id="modal-title">
            {item.ru}
          </h2>
          <p className="english">{item.name}</p>
        </div>
        <StarButton id={"item:" + item.key} />
      </div>
      <div className="recipe-summary">
        <span>
          <b>Станция</b>
          {recipe.stations.map(stationName).join(" + ")}
        </span>
        <span>
          <b>Выход за раз</b>×{recipe.amount}
        </span>
        <span>
          <b>Результат</b>×{batches * recipe.amount}
        </span>
      </div>
      <div className="recipe-controls">
        <label>
          Нужно предметов
          <input
            aria-label="Нужно предметов"
            type="number"
            min="1"
            max="99999"
            value={wanted}
            onChange={(e) =>
              patchModal({
                wanted: Math.max(
                  1,
                  Math.min(99999, Math.floor(Number(e.target.value) || 1)),
                ),
              })
            }
          />
        </label>
        {variants.length > 1 && (
          <label>
            Вариант рецепта
            <select
              aria-label="Вариант рецепта"
              value={recipe.id}
              onChange={(e) => patchModal({ variant: e.target.value })}
            >
              {variants.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i + 1}.{" "}
                  {r.ingredients
                    .map((g) => groupName(g) + " ×" + g.amount)
                    .join(", ")}{" "}
                  · {r.stations.map(stationName).join(" + ")}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="view-tabs" role="group" aria-label="Вид рецепта">
        <button
          className={!tree ? "active" : ""}
          aria-pressed={!tree}
          onClick={() => patchModal({ view: "list" })}
        >
          <List size={16} />
          Список
        </button>
        <button
          className={tree ? "active" : ""}
          aria-pressed={tree}
          onClick={() => patchModal({ view: "tree" })}
        >
          <GitBranch size={16} />
          Дерево крафта
        </button>
      </div>
      <p className={"recipe-status " + (status.enough ? "available" : "")}>
        {status.enough ? <Check size={17} /> : <Package size={17} />}{" "}
        {status.enough
          ? "Ингредиентов достаточно"
          : "Нужны дополнительные материалы"}{" "}
        · {batches} {batches === 1 ? "создание" : "создания"}
      </p>
      {tree ? (
        <div className="recipe-tree">
          <TreeNode
            key={recipe.id + ":" + wanted}
            itemKey={item.key}
            needed={wanted}
            forced={recipe}
            root
          />
          <p className="data-note">
            Ветви выбираются с учётом ресурсов, доступного этапа и станций. Их
            можно менять вручную. Количество округляется по выходу рецепта.
            Остатки соседних ветвей не считаются повторно доступными ресурсами:
            полный расход проверяй по списку выбранного рецепта.
          </p>
        </div>
      ) : (
        <div className="ingredient-list">
          {status.lines.map((g, i) => {
            const k =
                g.item ||
                g.options.find((k) => (state.inventory[k] || 0) >= g.needed) ||
                g.options[0],
              origin = "ingredient:" + recipe.id + ":" + i;
            return (
              <article key={i}>
                <button
                  className="ingredient-link"
                  onClick={() =>
                    open("item", k, origin, {
                      ingredient: true,
                      group: g.group,
                    })
                  }
                >
                  <SharedSprite item={k} origin={origin} />
                  <span>
                    <b>{g.item ? itemName(k) : "Любой подходящий материал"}</b>
                    {g.group && (
                      <small>{g.options.map(itemName).join(" / ")}</small>
                    )}
                    <small>Открыть способы получения ↗</small>
                  </span>
                </button>
                <div className="ingredient-qty">
                  <b>×{g.needed}</b>
                  <small className={g.missing ? "" : "available"}>
                    {g.missing ? "Не хватает " + g.missing : "Есть в рюкзаке"}
                  </small>
                  <small>
                    {g.have} / {g.needed}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="modal-actions">
        <button
          className="button"
          onClick={() => open("item", item.key, "recipe-source:" + item.key)}
        >
          Все способы получения <ArrowUpRight size={16} />
        </button>
        <a className="text-button" href={item.url} rel="noreferrer">
          Рецепт на wiki ↗
        </a>
      </div>
    </>
  );
}
