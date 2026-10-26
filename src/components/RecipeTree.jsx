import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  byKey,
  recipeMap,
  chooseRecipe,
  groupName,
  itemName,
  groups,
  stationName,
  availability,
  methods,
  allowed,
} from "../data/index.js";
import { Sprite, SharedSprite } from "./Sprite.jsx";
import { useStore } from "../state/Store.jsx";
export function TreeNode({
  itemKey,
  needed,
  ancestors = [],
  depth = 0,
  forced,
  root = false,
  path = "root",
}) {
  const { state, open } = useStore(),
    [expanded, setExpanded] = useState(root),
    [selected, setSelected] = useState(""),
    item = byKey.get(itemKey),
    cycle = ancestors.includes(itemKey),
    variants = recipeMap.get(itemKey) || [],
    recipe =
      forced ||
      variants.find((r) => r.id === selected) ||
      chooseRecipe(itemKey, state, ancestors),
    owned = state.inventory[itemKey] || 0,
    batches = recipe ? Math.ceil(needed / recipe.amount) : 0,
    origin = "tree:" + path + ":" + itemKey;
  return (
    <div className={"tree-node " + (root ? "tree-root" : "")}>
      <div className="tree-line">
        <button
          className="icon-button tree-expand"
          aria-label={
            (expanded ? "Свернуть " : "Развернуть ") + itemName(itemKey)
          }
          aria-expanded={expanded}
          disabled={!recipe || cycle || depth >= 12}
          onClick={() => setExpanded(!expanded)}
        >
          {recipe && !cycle ? (
            expanded ? (
              <ChevronDown size={17} />
            ) : (
              <ChevronRight size={17} />
            )
          ) : (
            <span className="tree-dot" />
          )}
        </button>
        <button
          className="tree-item"
          onClick={() => open("item", itemKey, origin, { ingredient: true })}
        >
          <SharedSprite item={item} origin={origin} />
          <span>
            <b>{itemName(itemKey)}</b>
            <small>
              Нужно {needed} · в рюкзаке {owned}
            </small>
          </span>
        </button>
        <span className={"tree-amount " + (owned >= needed ? "available" : "")}>
          {owned >= needed ? <Check size={15} /> : null}×{needed}
        </span>
      </div>
      {cycle ? (
        <p className="tree-leaf">
          Ветвь замыкает цикл.{" "}
          <button
            className="text-button"
            onClick={() => open("item", itemKey, origin, { ingredient: true })}
          >
            Выбрать внешний источник
          </button>
        </p>
      ) : !recipe ? (
        <div className="tree-leaf">
          <span>
            {item?.obtain
              .filter((m) => m !== "crafted")
              .map((m) => methods[m] || "Особое получение")
              .join(" · ") || "Источник в мире"}
          </span>
          <button
            className="text-button"
            onClick={() => open("item", itemKey, origin, { ingredient: true })}
          >
            Где найти <ExternalLink size={12} />
          </button>
        </div>
      ) : expanded && depth < 12 ? (
        <div className="tree-children">
          {!forced && variants.length > 1 && (
            <label className="tree-variant">
              Вариант рецепта
              <select
                aria-label={"Вариант для " + itemName(itemKey)}
                value={recipe.id}
                onChange={(e) => setSelected(e.target.value)}
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
          <p className="tree-station">
            {recipe.stations.map(stationName).join(" + ")} · {batches}{" "}
            {batches === 1 ? "создание" : "создания"} →{" "}
            {batches * recipe.amount} шт.
          </p>
          {recipe.ingredients.map((g, i) =>
            g.item ? (
              <TreeNode
                key={i + ":" + g.item + ":" + recipe.id}
                itemKey={g.item}
                needed={g.amount * batches}
                ancestors={[...ancestors, itemKey]}
                depth={depth + 1}
                path={path + "-" + i}
              />
            ) : (
              <GroupBranch
                key={i + ":" + g.group + ":" + recipe.id}
                group={g}
                needed={g.amount * batches}
                ancestors={[...ancestors, itemKey]}
                depth={depth + 1}
                path={path + "-" + i}
              />
            ),
          )}
        </div>
      ) : depth >= 12 ? (
        <div className="tree-leaf">
          <button
            className="text-button"
            onClick={() => open("recipe", itemKey, origin)}
          >
            Продолжить в рецепте компонента
          </button>
        </div>
      ) : null}
    </div>
  );
}
function GroupBranch({ group, needed, ...props }) {
  const { state } = useStore(),
    options = (groups[group.group]?.items || []).filter((k) =>
      allowed(byKey.get(k), state),
    ),
    ordered = [...options].sort(
      (a, b) => (state.inventory[b] || 0) - (state.inventory[a] || 0),
    ),
    [selected, setSelected] = useState(""),
    key = options.includes(selected) ? selected : ordered[0];
  return (
    <div className="group-branch">
      <label>
        Один из материалов
        <select
          aria-label={"Материал группы " + group.group}
          value={key}
          onChange={(e) => setSelected(e.target.value)}
        >
          {options.map((k) => (
            <option key={k} value={k}>
              {itemName(k)} · есть {state.inventory[k] || 0}
            </option>
          ))}
        </select>
      </label>
      {key && <TreeNode {...props} itemKey={key} needed={needed} />}
    </div>
  );
}
