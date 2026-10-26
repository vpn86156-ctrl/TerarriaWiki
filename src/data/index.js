import data from "./catalog.json";
export { data };
export const categories = {
  weapon: "Оружие",
  ammunition: "Боеприпасы",
  tool: "Инструменты",
  armor: "Броня",
  accessory: "Аксессуары",
  vanity: "Костюмы",
  developer: "Предметы разработчиков",
  sets: "Комплекты",
  dye: "Красители",
  potion: "Зелья",
  food: "Еда",
  consumable: "Расходники",
  "permanent-booster": "Постоянные усиления",
  "crafting-material": "Материалы",
  block: "Блоки",
  wall: "Стены",
  furniture: "Мебель",
  lighting: "Освещение",
  mechanism: "Механизмы",
  pet: "Питомцы",
  mount: "Транспорт",
  "light-pet": "Светящиеся питомцы",
  hook: "Крюки",
  minecart: "Вагонетки",
  painting: "Картины",
  music: "Музыка",
  misc: "Разное",
  other: "Разное",
  summoning: "Призыв",
  seed: "Семена",
  plant: "Растения",
  bait: "Наживка",
  quest: "Задания",
  wings: "Крылья",
  "boss-summon": "Призыв боссов",
};
export const biomes = {
  forest: "Лес",
  "forest-surface": "Лес",
  hallow: "Освящение",
  underground: "Подземелье",
  desert: "Пустыня",
  jungle: "Джунгли",
  ocean: "Океан",
  snow: "Снега",
  mushroom: "Грибной биом",
  "underground-jungle": "Подземные джунгли",
  corruption: "Порча",
  crimson: "Багрянец",
  dungeon: "Темница",
  underworld: "Ад",
  sky: "Небо",
  space: "Космос",
  graveyard: "Кладбище",
  "snow-underground": "Подземные снега",
};
export const methods = {
  crafted: "Крафт",
  vendor: "Магазины",
  drop: "Дроп противников",
  loot: "Сундуки и горшки",
  plunder: "Находки в мире",
  "shaking-tree": "Встряхивание деревьев",
  bag: "Контейнеры и ящики",
  "treasure-bag": "Сокровищницы боссов",
  fishing: "Рыбалка",
  "quest-reward": "Задания рыбака",
  "strange-plant": "Награды за растения",
  caught: "Ловля сачком",
  extractinator: "Экстрактинатор",
  "extractinator-regular": "Экстрактинатор",
  "chlorophyte-extractinator": "Хлорофитовый экстрактинатор",
  shimmer: "Мерцание",
  transformation: "Превращение",
  special: "Особые условия",
  other: "Другие способы",
  starting: "Начальное снаряжение",
  unobtainable: "Недоступно обычным способом",
};
export const classes = {
  melee: "Ближний бой",
  ranged: "Дальний бой",
  magic: "Магия",
  summon: "Призыв",
  throwing: "Метательное",
};
export const platforms = {
  desktop: "ПК",
  console: "Консоли",
  mobile: "Мобильная",
  oldgen: "Старые консоли",
  "3ds": "Nintendo 3DS",
  japanese: "Японская версия",
};
Object.assign(categories, {
  summon: "Предметы призыва",
  "crafting-station": "Станции крафта",
  banner: "Знамёна",
  "light-source": "Освещение",
  storage: "Хранилища",
  crate: "Рыболовные ящики",
  "grab-bag": "Мешки и контейнеры",
  key: "Ключи",
  seeds: "Семена",
  miscellaneous: "Разное",
});
Object.assign(biomes, {
  "jungle-temple": "Храм джунглей",
  "glowing-mushroom": "Светящийся грибной биом",
  "granite-marble": "Гранит и мрамор",
  "spider-nest": "Паучье гнездо",
  meteorite: "Метеорит",
});
const stationNames = {
  "By Hand": "Руками",
  "Iron Anvil": "Железная / свинцовая наковальня",
  "Mythril Anvil": "Мифриловая / орихалковая наковальня",
  "Work Bench": "Верстак",
  "Placed Bottle": "Бутылка на столе",
  "Demon Altar": "Алтарь демонов / багровый алтарь",
  Water: "Вода",
  Honey: "Мёд",
  Lava: "Лава",
  "Ecto Mist": "Могильный туман",
  "Snow Biome": "Снежный биом",
};
export const items = data.items;
export const byKey = new Map(items.map((i) => [i.key, i]));
export const recipes = data.craft.recipes;
export const groups = data.craft.groups;
export const recipeMap = new Map();
for (const r of recipes) {
  if (!recipeMap.has(r.result)) recipeMap.set(r.result, []);
  recipeMap.get(r.result).push(r);
}
export const itemName = (key) => byKey.get(key)?.ru || key;
export const stationName = (s) =>
  stationNames[s] || itemName(data.craft.stations[s]?.items?.[0]) || s;
export function label(value, map) {
  return map[value] || value.replaceAll("-", " ");
}
export function categoryName(i) {
  return (i?.categories || [])
    .map(
      (c) =>
        categories[c] ||
        {
          wire: "Провода",
          coin: "Монеты",
          critter: "Животные",
          "quest-fish": "Рыба для заданий",
          catchable: "Ловля",
          trophy: "Трофеи",
          relic: "Реликвии",
          fishing: "Рыбалка",
          "boss-summoning": "Призыв боссов",
        }[c] ||
        "Прочее",
    )
    .join(" · ");
}
const milestone = {
  start: 0,
  "king-slime": 1,
  "eye-of-cthulhu": 2,
  "evil-boss": 3,
  "queen-bee": 4,
  deerclops: 4,
  skeletron: 5,
  "wall-of-flesh": 7,
  "queen-slime": 7,
  "any-mech": 7,
  "all-mechs": 8,
  plantera: 9,
  golem: 9,
  cultist: 10,
  "lunatic-cultist": 10,
  "duke-empress": 9,
  "moon-lord": 10,
};
export const phase = (i) =>
  Math.max(i?.hardmode ? 7 : 0, milestone[i?.milestone] ?? 0);
export const norm = (s) =>
  String(s ?? "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .trim();
export const allowed = (i, state) =>
  !state.spoilers || phase(i) <= Math.min(state.completed, 10);
export function recipePhase(r) {
  const ingredients = r.ingredients.map((g) =>
    g.item
      ? phase(byKey.get(g.item))
      : Math.min(
          ...(groups[g.group]?.items || []).map((k) => phase(byKey.get(k))),
        ),
  );
  const stations = r.stations.map((s) => {
    const keys = data.craft.stations[s]?.items || [];
    return keys.length ? Math.min(...keys.map((k) => phase(byKey.get(k)))) : 0;
  });
  return Math.max(phase(byKey.get(r.result)), ...ingredients, ...stations);
}
// Allocate resources with a small max-flow network: overlapping groups must not spend the same stack twice.
export function availability(recipe, inventory, multiplier = 1) {
  const lines = recipe.ingredients.map((g) => ({
    ...g,
    needed: g.amount * multiplier,
    options: g.item ? [g.item] : groups[g.group]?.items || [],
  }));
  const keys = [...new Set(lines.flatMap((g) => g.options))],
    N = keys.length + lines.length + 2,
    S = N - 2,
    T = N - 1,
    edges = Array.from({ length: N }, () => []);
  const add = (a, b, cap) => {
    const f = { to: b, cap, rev: edges[b].length, original: cap },
      r = { to: a, cap: 0, rev: edges[a].length };
    edges[a].push(f);
    edges[b].push(r);
    return f;
  };
  keys.forEach((k, i) => add(S, i, Math.max(0, Number(inventory[k]) || 0)));
  const req = [];
  lines.forEach((g, j) => {
    g.options.forEach((k) => add(keys.indexOf(k), keys.length + j, 1e9));
    req.push(add(keys.length + j, T, g.needed));
  });
  let total = 0;
  while (true) {
    const prev = Array(N).fill(null),
      queue = [S];
    prev[S] = true;
    for (let q = 0; q < queue.length && !prev[T]; q++)
      for (let e = 0; e < edges[queue[q]].length; e++) {
        const edge = edges[queue[q]][e];
        if (edge.cap > 0 && !prev[edge.to]) {
          prev[edge.to] = [queue[q], e];
          queue.push(edge.to);
        }
      }
    if (!prev[T]) break;
    let f = 1e9;
    for (let v = T; v !== S;) {
      const [a, e] = prev[v];
      f = Math.min(f, edges[a][e].cap);
      v = a;
    }
    for (let v = T; v !== S;) {
      const [a, e] = prev[v],
        edge = edges[a][e];
      edge.cap -= f;
      edges[v][edge.rev].cap += f;
      v = a;
    }
    total += f;
  }
  return {
    enough: lines.every((g, j) => req[j].cap === 0),
    lines: lines.map((g, j) => ({
      ...g,
      have: g.needed - req[j].cap,
      missing: req[j].cap,
    })),
    total,
  };
}
export function chooseRecipe(key, state, ancestors = []) {
  return (recipeMap.get(key) || [])
    .filter(
      (r) => !r.ingredients.some((g) => g.item && ancestors.includes(g.item)),
    )
    .map((r) => ({
      r,
      score:
        (state.spoilers && recipePhase(r) > state.completed ? 100000 : 0) +
        availability(r, state.inventory).lines.reduce(
          (s, g) => s + g.missing,
          0,
        ) *
          10 +
        r.stations.reduce(
          (s, n) =>
            s +
            (data.craft.stations[n]?.items?.some(
              (k) => (state.inventory[k] || 0) > 0,
            ) || n === "By Hand"
              ? 0
              : 20),
          0,
        ) +
        r.ingredients.length,
    }))
    .sort((a, b) => a.score - b.score || a.r.id.localeCompare(b.r.id))[0]?.r;
}
export function groupName(g) {
  if (g.item) return itemName(g.item);
  return (
    (g.group?.startsWith("Any ") ? "Любой вариант: " : "Группа: ") +
    (groups[g.group]?.items || []).map(itemName).join(" / ")
  );
}
export const craftItems = [...recipeMap.keys()]
  .map((k) => byKey.get(k))
  .filter(Boolean)
  .sort((a, b) => phase(a) - phase(b) || a.id - b.id);
const craftSearch = new Map(
  craftItems.map((i) => [
    i.key,
    norm(
      [
        i.ru,
        i.name,
        ...(recipeMap.get(i.key) || []).flatMap((r) => [
          ...r.stations.flatMap((s) => [s, stationName(s)]),
          ...r.ingredients.flatMap((g) =>
            (g.item ? [g.item] : groups[g.group]?.items || []).flatMap((k) => [
              itemName(k),
              byKey.get(k)?.name,
            ]),
          ),
        ]),
      ].join(" "),
    ),
  ]),
);
export function filterCrafts(
  { query = "", category = "", station = "", ready = false, favorite = false },
  state,
) {
  const q = norm(query);
  return craftItems.filter(
    (i) =>
      allowed(i, state) &&
      (!q || craftSearch.get(i.key).includes(q)) &&
      (!category || i.categories.includes(category)) &&
      (!favorite || state.favorites.includes("item:" + i.key)) &&
      (recipeMap.get(i.key) || []).some(
        (r) =>
          (!state.spoilers || recipePhase(r) <= state.completed) &&
          (!station || r.stations.includes(station)) &&
          (!ready || availability(r, state.inventory).enough),
      ),
  );
}
export function filterItems(filters, state) {
  const q = norm(filters.query);
  return items.filter(
    (i) =>
      allowed(i, state) &&
      (!q || norm(i.ru + " " + i.name).includes(q)) &&
      (!filters.category || i.categories.includes(filters.category)) &&
      (!filters.method || i.obtain.includes(filters.method)) &&
      (!filters.biome || i.biomes.includes(filters.biome)) &&
      (!filters.class || i.damageType === filters.class) &&
      (!filters.version ||
        i.version === filters.version ||
        i.introduced === filters.version) &&
      (!filters.platform || i.platforms.includes(filters.platform)) &&
      (!filters.stage || phase(i) === Number(filters.stage) - 1) &&
      (!filters.favorite || state.favorites.includes("item:" + i.key)),
  );
}
const npcById = new Map(
  data.npcs.filter((n) => n.main).map((n) => [n.preferences.id, n]),
);
export function filterNPCs(query = "", biome = "", favorite = false, state) {
  const q = norm(query);
  return data.npcs.filter(
    (n) =>
      n.main &&
      (!biome ||
        [n.preferences.biome?.liked, n.preferences.biome?.loved].includes(
          biome,
        )) &&
      (!favorite || state.favorites.includes("npc:" + n.id)) &&
      (!q ||
        norm(
          [
            n.ru,
            n.name,
            ...Object.values(n.preferences.neighbors)
              .flat()
              .map((k) => npcById.get(k)?.ru || k),
          ].join(" "),
        ).includes(q)),
  );
}
export const npcName = (id) => npcById.get(id)?.ru || id;
export function sourceName(s) {
  if (s?.ru && s.ru !== s.name) return s.ru;
  const n = data.npcs.find((n) => n.name === s?.name);
  return (
    n?.ru ||
    {
      Chest: "Сундук",
      "Gold Chest": "Золотой сундук",
      "Eye of Cthulhu": "Глаз Ктулху",
      "King Slime": "Король слизней",
      Zombie: "Зомби",
      "Blue Slime": "Синий слизень",
      "Wood Slime": "Древесный слизень",
      "Wooden Crate": "Деревянный ящик",
      "Pearlwood Crate": "Ящик из жемчужного дерева",
      Fishing: "Рыбалка",
    }[s?.name] ||
    s?.name ||
    "Источник не указан"
  );
}
export const conditionNames = {
  day: "Днём",
  night: "Ночью",
  hardmode: "Хардмод",
  "blood-moon": "Кровавая луна",
  rain: "Дождь",
  graveyard: "Кладбище",
  "after-eye-of-cthulhu": "После Глаза Ктулху",
  "after-golem": "После Голема",
  "after-plantera": "После Плантеры",
  "after-moon-lord": "После Лунного лорда",
  "after-any-mech": "После любого механического босса",
  "moon-1": "Полнолуние",
  "moon-2": "Убывающая луна",
  "moon-3": "Третья четверть",
  "moon-4": "Убывающий серп",
  "moon-5": "Новолуние",
  "moon-6": "Растущий серп",
  "moon-7": "Первая четверть",
  "moon-8": "Растущая луна",
};
export function conditionText(ids = []) {
  return ids
    .map(
      (id) =>
        conditionNames[id] ||
        data.conditions.conditions.find((c) => c.id === id)?.name ||
        id,
    )
    .join(" · ");
}
export function description(i) {
  return (
    i.ruTooltip ||
    `${categoryName(i)}. ${i.damage ? `Урон: ${i.damage}. ` : ""}${i.defense ? `Защита: ${i.defense}. ` : ""}${i.stack ? `Максимум в ячейке: ${i.stack}. ` : ""}${i.hardmode ? "Предмет хардмода. " : ""}${i.unobtainable ? "Недоступен в обычном прохождении. " : ""}Способы получения приведены по снимку официальной wiki от ${data.meta.dataVersion}.`
  );
}
export const formatNumber = (n) => new Intl.NumberFormat("ru-RU").format(n);
