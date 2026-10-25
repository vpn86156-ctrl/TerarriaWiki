export const RARITIES = [
  { id: "common", name: "Обычная", chance: 60, color: "#a5bab0", refund: 15 },
  { id: "rare", name: "Редкая", chance: 25, color: "#75baff", refund: 30 },
  { id: "epic", name: "Эпическая", chance: 12, color: "#c291ff", refund: 60 },
  {
    id: "legendary",
    name: "Легендарная",
    chance: 3,
    color: "#edbe67",
    refund: 100,
  },
];
export const CASE_PRICE = 100;
export const ITEMS = [
  {
    id: "wanderer",
    slot: "skin",
    name: "Странник",
    rarity: "common",
    color: "#55a89c",
    effect: "Твой первый факел",
    stats: {},
  },
  {
    id: "worn",
    slot: "boots",
    name: "Походные",
    rarity: "common",
    color: "#74694f",
    effect: "Надёжная классика",
    stats: {},
  },
  {
    id: "moss",
    slot: "skin",
    name: "Хранитель мха",
    rarity: "common",
    color: "#8ba77a",
    effect: "Радиус света +0,3 клетки",
    stats: { vision: 0.3 },
  },
  {
    id: "sand",
    slot: "skin",
    name: "Искатель песков",
    rarity: "common",
    color: "#c5a979",
    effect: "Радиус света +0,3 клетки",
    stats: { vision: 0.3 },
  },
  {
    id: "leather",
    slot: "boots",
    name: "Лёгкая кожа",
    rarity: "common",
    color: "#ad8766",
    effect: "Скорость +3%",
    stats: { speed: 0.03 },
  },
  {
    id: "scout",
    slot: "boots",
    name: "Разведчик",
    rarity: "common",
    color: "#8cab83",
    effect: "Перезарядка рывка −0,05 с",
    stats: { cooldown: 0.05 },
  },
  {
    id: "tide",
    slot: "skin",
    name: "Смотритель приливов",
    rarity: "rare",
    color: "#6aaed3",
    effect: "Радиус света +0,7 клетки",
    stats: { vision: 0.7 },
  },
  {
    id: "moon",
    slot: "skin",
    name: "Лунный следопыт",
    rarity: "rare",
    color: "#99a5d1",
    effect: "Перезарядка рывка −0,1 с",
    stats: { cooldown: 0.1 },
  },
  {
    id: "wind",
    slot: "boots",
    name: "Шаг ветра",
    rarity: "rare",
    color: "#72b9d4",
    effect: "Скорость +7%",
    stats: { speed: 0.07 },
  },
  {
    id: "spring",
    slot: "boots",
    name: "Пружина",
    rarity: "rare",
    color: "#9db4cd",
    effect: "Перезарядка рывка −0,15 с",
    stats: { cooldown: 0.15 },
  },
  {
    id: "violet",
    slot: "skin",
    name: "Сумеречный маг",
    rarity: "epic",
    color: "#aa85cf",
    effect: "Свет +1 клетка · рывок −0,1 с",
    stats: { vision: 1, cooldown: 0.1 },
  },
  {
    id: "ember",
    slot: "skin",
    name: "Дитя углей",
    rarity: "epic",
    color: "#da8f78",
    effect: "Скорость +4% · свет +0,5 клетки",
    stats: { speed: 0.04, vision: 0.5 },
  },
  {
    id: "phase",
    slot: "boots",
    name: "Теневой шаг",
    rarity: "epic",
    color: "#ad82d3",
    effect: "Скорость +10%",
    stats: { speed: 0.1 },
  },
  {
    id: "comet",
    slot: "boots",
    name: "Комета",
    rarity: "epic",
    color: "#c88fbc",
    effect: "Скорость +6% · рывок −0,15 с",
    stats: { speed: 0.06, cooldown: 0.15 },
  },
  {
    id: "sun",
    slot: "skin",
    name: "Солнечный страж",
    rarity: "legendary",
    color: "#ecc976",
    effect: "Щит от одного удара · скорость +3%",
    stats: { shield: 1, speed: 0.03 },
  },
  {
    id: "phoenix",
    slot: "skin",
    name: "Феникс",
    rarity: "legendary",
    color: "#eea16c",
    effect: "Щит от одного удара · свет +0,5 клетки",
    stats: { shield: 1, vision: 0.5 },
  },
  {
    id: "mercury",
    slot: "boots",
    name: "Крылья Меркурия",
    rarity: "legendary",
    color: "#e6c67d",
    effect: "Скорость +15% · рывок −0,1 с",
    stats: { speed: 0.15, cooldown: 0.1 },
  },
  {
    id: "aurora",
    slot: "boots",
    name: "Северное сияние",
    rarity: "legendary",
    color: "#f0dbad",
    effect: "Скорость +12% · свет +0,7 клетки",
    stats: { speed: 0.12, vision: 0.7 },
  },
];
const byId = (id) => ITEMS.find((item) => item.id === id);
export class Profile {
  constructor(storage) {
    this.storage = storage;
    this.persistent = !!storage;
    let raw = {};
    try {
      raw = JSON.parse(storage?.getItem("last-torch:profile-v2") || "{}") || {};
    } catch {
      this.persistent = false;
    }
    this.coins =
      Number.isSafeInteger(raw.coins) && raw.coins >= 0
        ? Math.min(raw.coins, 1e9)
        : 0;
    this.owned = new Set([
      "wanderer",
      "worn",
      ...(Array.isArray(raw.owned) ? raw.owned.filter((id) => byId(id)) : []),
    ]);
    this.equipped = { skin: "wanderer", boots: "worn" };
    for (const slot of ["skin", "boots"])
      if (
        this.owned.has(raw.equipped?.[slot]) &&
        byId(raw.equipped[slot])?.slot === slot
      )
        this.equipped[slot] = raw.equipped[slot];
    this.opened =
      Number.isSafeInteger(raw.opened) && raw.opened > 0 ? raw.opened : 0;
  }
  save() {
    try {
      this.storage?.setItem(
        "last-torch:profile-v2",
        JSON.stringify({
          coins: this.coins,
          owned: [...this.owned],
          equipped: this.equipped,
          opened: this.opened,
        }),
      );
    } catch {
      this.persistent = false;
    }
  }
  earn(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    this.coins = Math.min(1e9, this.coins + amount);
    this.save();
  }
  equip(id) {
    const item = byId(id);
    if (!item || !this.owned.has(id)) return false;
    this.equipped[item.slot] = id;
    this.save();
    return true;
  }
  stats() {
    const skin = byId(this.equipped.skin),
      boots = byId(this.equipped.boots),
      stats = { speed: 0, cooldown: 0, vision: 0, shield: 0 };
    for (const item of [skin, boots])
      for (const [k, v] of Object.entries(item.stats)) stats[k] += v;
    stats.speed = Math.min(stats.speed, 0.2);
    stats.cooldown = Math.min(stats.cooldown, 0.35);
    return {
      ...stats,
      color: skin.color,
      bootsColor: boots.color,
      skin: skin.id,
      boots: boots.id,
    };
  }
  openCase(
    random = () => {
      const n = new Uint32Array(1);
      crypto.getRandomValues(n);
      return n[0] / 4294967296;
    },
  ) {
    if (this.coins < CASE_PRICE) return null;
    const a = random(),
      b = random();
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      a < 0 ||
      a >= 1 ||
      b < 0 ||
      b >= 1
    )
      throw new Error("Invalid random sample");
    let sum = 0;
    const rarity = RARITIES.find((r) => {
      sum += r.chance;
      return a * 100 < sum;
    });
    const pool = ITEMS.filter(
        (i) => i.rarity === rarity.id && !["wanderer", "worn"].includes(i.id),
      ),
      item = pool[Math.floor(b * pool.length)];
    this.coins -= CASE_PRICE;
    const duplicate = this.owned.has(item.id),
      refund = duplicate ? rarity.refund : 0;
    this.coins += refund;
    this.owned.add(item.id);
    this.opened++;
    this.save();
    return { item, duplicate, refund, rarity };
  }
}
let storage;
try {
  storage = globalThis.localStorage;
} catch {}
export const profile = new Profile(storage);
