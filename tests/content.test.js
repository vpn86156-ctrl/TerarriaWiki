/* Содержимое игры: целостность таблиц оружия, врагов, локаций и магазина. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCATIONS, ENEMIES, WEAPONS, SHOP_ITEMS, SHOP_WEAPONS, AMMO_LABEL, TUTORIAL, TILE, STARTER,
} from '../src/content.js';

test('тайл квадратный и кратен 16', () => {
  assert.equal(TILE, 16);
});

test('три локации, у каждой палитра, враги и босс', () => {
  assert.equal(LOCATIONS.length, 3);
  let levels = 0;
  for (const location of LOCATIONS) {
    assert.ok(location.name && location.short, 'название локации');
    assert.ok(location.intro.length > 20, 'описание локации');
    assert.ok(location.levels >= 3, 'сколько этажей в локации');
    levels += location.levels;
    assert.ok(location.enemies.length >= 3, 'набор врагов');
    for (const type of location.enemies) assert.ok(ENEMIES[type], `неизвестный враг ${type}`);
    const palette = location.palette;
    assert.ok(Array.isArray(palette.floor) && palette.floor.length >= 3, 'цвета пола');
    for (const color of [...palette.floor, palette.wall, palette.wallTop, palette.shadow, palette.accent, palette.torch, palette.fog, palette.blood]) {
      assert.match(color, /^#[0-9a-f]{6}$/i, `цвет ${color}`);
    }
    const boss = location.boss;
    assert.ok(boss.name && boss.subtitle, 'имя босса');
    assert.ok(boss.health >= 40 && boss.health <= 200, 'здоровье босса');
    assert.ok(boss.attacks.length >= 2, 'атаки босса');
    assert.ok(boss.reward > 0, 'награда за босса');
    for (const attack of boss.attacks) {
      assert.ok(['slam', 'volley', 'charge', 'summon', 'syringe'].includes(attack), `атака ${attack}`);
    }
  }
  assert.ok(levels >= 9 && levels <= 12, `всего этажей: ${levels}`);
});

test('у каждого врага полный набор характеристик', () => {
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    assert.ok(enemy.name, `имя ${id}`);
    assert.ok(enemy.health > 0 && enemy.speed > 0 && enemy.damage > 0, `боевые параметры ${id}`);
    assert.ok(enemy.sight > 0 && enemy.reach > 0, `дальность ${id}`);
    assert.ok(['chase', 'ranged'].includes(enemy.brain), `мозг ${id}`);
    assert.ok(Array.isArray(enemy.color) && enemy.color.length === 2, `цвета ${id}`);
    assert.ok(enemy.coins > 0, `монеты ${id}`);
  }
});

test('оружие: три ближних и три с патронами', () => {
  const melee = Object.values(WEAPONS).filter((weapon) => weapon.kind === 'melee');
  const guns = Object.values(WEAPONS).filter((weapon) => weapon.kind === 'gun');
  assert.equal(melee.length, 3);
  assert.equal(guns.length, 3);
  for (const weapon of melee) {
    assert.ok(weapon.damage > 0 && weapon.cooldown > 0 && weapon.reach > 0 && weapon.arc > 0, weapon.name);
  }
  for (const weapon of guns) {
    assert.ok(weapon.damage > 0 && weapon.cooldown > 0, weapon.name);
    assert.ok(weapon.magazine > 0 && weapon.reload > 0, `магазин ${weapon.name}`);
    assert.ok(AMMO_LABEL[weapon.ammo], `тип патронов ${weapon.ammo}`);
    assert.ok(weapon.pellets >= 1 && weapon.spread >= 0, `дробь ${weapon.name}`);
  }
});

test('стартовый набор есть в таблице оружия', () => {
  assert.ok(WEAPONS[STARTER.melee], 'стартовое оружие ближнего боя');
  assert.equal(WEAPONS[STARTER.melee].kind, 'melee');
});

test('магазин: расходники и оружие с ценами и описаниями', () => {
  assert.ok(SHOP_ITEMS.length >= 6, 'позиции магазина');
  for (const item of [...SHOP_ITEMS, ...SHOP_WEAPONS]) {
    assert.ok(item.id && item.name && item.description, `карточка ${item.id}`);
    assert.ok(item.price > 0, `цена ${item.id}`);
  }
  for (const item of SHOP_WEAPONS) {
    assert.ok(WEAPONS[item.weapon], `оружие в магазине: ${item.weapon}`);
    assert.equal(item.name, WEAPONS[item.weapon].name);
  }
  const ids = new Set(SHOP_ITEMS.map((item) => item.id));
  assert.equal(ids.size, SHOP_ITEMS.length, 'id позиций не повторяются');
});

test('туториал: пять подсказок про управление', () => {
  assert.equal(TUTORIAL.length, 5);
  const keys = TUTORIAL.map((step) => step.key);
  for (const key of ['move', 'melee', 'shoot', 'keys', 'light']) assert.ok(keys.includes(key), key);
  for (const step of TUTORIAL) assert.ok(step.text.length > 30, 'текст подсказки');
});
