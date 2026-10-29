/* Симуляция «Заброшки»: генерация уровней, бой, двери, боссы, устойчивость. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, updateGame, tileAt, solidAt, lineOfSight, applyPurchase, equipWeapon, levelTitle,
  VOID, FLOOR, WALL, DOOR, EXIT,
} from '../src/engine.js';
import { LOCATIONS, TILE, WEAPONS } from '../src/content.js';
import { reachableTiles } from './helpers.js';

const SEEDS = [1, 7, 13, 29, 101, 331, 613, 907, 1543, 2287, 5003, 7919];

test('константы тайлов согласованы', () => {
  assert.deepEqual([VOID, FLOOR, WALL, DOOR, EXIT], [0, 1, 2, 3, 4]);
  assert.equal(TILE, 16);
});

test('уровень генерируется проходимым: выход и ключи достижимы', () => {
  for (let loc = 0; loc < LOCATIONS.length; loc += 1) {
    for (let slot = 0; slot < LOCATIONS[loc].levels; slot += 1) {
      for (const seed of SEEDS) {
        const game = createGame({ seed, locationIndex: loc, slot, upgrades: {} });
        const level = game.level;
        // Ключи должны быть доступны до двери, а выход — после (за дверью).
        const seen = reachableTiles(game);
        const seenWithDoor = reachableTiles(game, { withDoor: true });
        const exitTile = Math.floor(level.exit.y / TILE) * level.w + Math.floor(level.exit.x / TILE);
        assert.ok(seenWithDoor.has(exitTile), `выход недостижим: ${loc}/${slot}/${seed}`);
        for (const prop of level.props.filter((item) => item.key)) {
          const key = Math.floor(prop.y / TILE) * level.w + Math.floor(prop.x / TILE);
          assert.ok(seen.has(key), `ключ в ящике недостижим: ${loc}/${slot}/${seed}`);
        }
        for (const pickup of level.pickups.filter((item) => item.kind === 'key')) {
          const key = Math.floor(pickup.y / TILE) * level.w + Math.floor(pickup.x / TILE);
          assert.ok(seen.has(key), `ключ на полу недостижим: ${loc}/${slot}/${seed}`);
        }
      }
    }
  }
});

test('точка появления безопасна: враги и босс далеко', () => {
  for (let loc = 0; loc < LOCATIONS.length; loc += 1) {
    for (let slot = 0; slot < LOCATIONS[loc].levels; slot += 1) {
      for (const seed of SEEDS) {
        const game = createGame({ seed, locationIndex: loc, slot, upgrades: {} });
        const spawn = { x: game.player.x, y: game.player.y };
        assert.ok(!solidAt(game, spawn.x, spawn.y), `спавн в стене: ${loc}/${slot}/${seed}`);
        for (const enemy of game.level.enemies) {
          const d = Math.hypot(enemy.x - spawn.x, enemy.y - spawn.y);
          assert.ok(d >= 100, `враг в ${d.toFixed(0)} px от спавна: ${loc}/${slot}/${seed}`);
        }
        if (game.level.boss) {
          const d = Math.hypot(game.level.boss.x - spawn.x, game.level.boss.y - spawn.y);
          assert.ok(d >= 150, `босс в ${d.toFixed(0)} px от спавна: ${loc}/${slot}/${seed}`);
        }
      }
    }
  }
});

test('босс живёт только на последнем этаже локации', () => {
  for (let loc = 0; loc < LOCATIONS.length; loc += 1) {
    for (let slot = 0; slot < LOCATIONS[loc].levels; slot += 1) {
      const expected = slot === LOCATIONS[loc].levels - 1;
      for (const seed of SEEDS.slice(0, 4)) {
        const game = createGame({ seed, locationIndex: loc, slot, upgrades: {} });
        assert.equal(!!game.level.boss, expected, `босс: ${loc}/${slot}`);
      }
    }
  }
});

test('одинаковое зерно даёт одинаковый уровень', () => {
  const a = createGame({ seed: 4242, locationIndex: 1, slot: 1, upgrades: {} });
  const b = createGame({ seed: 4242, locationIndex: 1, slot: 1, upgrades: {} });
  assert.deepEqual(Array.from(a.level.grid), Array.from(b.level.grid));
  assert.equal(a.level.enemies.length, b.level.enemies.length);
});

test('долгая симуляция не ломает состояние', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const game = createGame({ seed, locationIndex: 2, slot: 1, upgrades: {} });
    for (let step = 0; step < 60 * 60; step += 1) {
      const angle = step / 37;
      updateGame(game, 1 / 60, {
        move: { x: Math.cos(angle), y: Math.sin(angle) },
        melee: step % 40 < 4,
        shoot: step % 90 < 3,
        reload: step % 240 === 0,
      });
      if (game.dead || game.complete) break;
    }
    assert.ok(Number.isFinite(game.player.x) && Number.isFinite(game.player.y), `NaN координаты, зерно ${seed}`);
    assert.ok(Number.isFinite(game.player.health), 'здоровье испорчено');
    assert.ok(game.player.health <= game.player.maxHealth, 'здоровье выше максимума');
    for (const enemy of game.level.enemies) {
      assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y), 'NaN у врага');
    }
    for (const value of Object.values(game.player.ammo)) assert.ok(Number.isFinite(value) && value >= 0, 'патроны');
    assert.ok(game.player.grenades >= 0, 'гранаты ушли в минус');
  }
});

test('игрок не застревает в стенах при отбрасывании', () => {
  const game = createGame({ seed: 909, locationIndex: 0, slot: 0, upgrades: {} });
  // Толкаем игрока во все стороны: отбрасывание не должно затащить его в стену.
  for (let step = 0; step < 600; step += 1) {
    const angle = (step / 600) * Math.PI * 2;
    game.player.invulnerable = 0;
    game.player.vx = Math.cos(angle) * 900;
    game.player.vy = Math.sin(angle) * 900;
    updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
    assert.ok(!solidAt(game, game.player.x, game.player.y), `игрок в стене на шаге ${step}`);
  }
});

test('дверь открывается ключом, когда подходишь вплотную', () => {
  const game = createGame({ seed: 55, locationIndex: 0, slot: 0, upgrades: {} });
  const door = game.level.door;
  assert.equal(tileAt(game, door.x * TILE + TILE / 2, door.y * TILE + TILE / 2), DOOR);
  game.keys = 1;
  game.player.x = door.x * TILE + TILE / 2;
  game.player.y = (door.y + 1) * TILE + TILE / 2;
  updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.equal(game.doorOpen, true, 'дверь не открылась рядом с игроком');
  assert.equal(game.keys, 0, 'ключ не потрачен');
  assert.notEqual(tileAt(game, door.x * TILE + TILE / 2, door.y * TILE + TILE / 2), DOOR);
});

test('без ключа дверь остаётся запертой', () => {
  const game = createGame({ seed: 55, locationIndex: 0, slot: 0, upgrades: {} });
  const door = game.level.door;
  game.player.x = door.x * TILE + TILE / 2;
  game.player.y = (door.y + 1) * TILE + TILE / 2;
  for (let step = 0; step < 120; step += 1) updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.equal(game.doorOpen, false);
  assert.equal(tileAt(game, door.x * TILE + TILE / 2, door.y * TILE + TILE / 2), DOOR);
});

test('смерть босса открывает выход и не роняет симуляцию', () => {
  const game = createGame({ seed: 321, locationIndex: 0, slot: LOCATIONS[0].levels - 1, upgrades: {} });
  const boss = game.level.boss;
  assert.ok(boss, 'на последнем этаже должен быть босс');
  // Прямой урон, как от гранаты: раньше босс умирал «неправильно» и дверь оставалась запертой.
  game.grenades.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, fuse: .01, radius: 6, spin: 0 });
  const before = boss.health;
  for (let step = 0; step < 30; step += 1) updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.ok(boss.health < before, 'босс не получил урон от взрыва');
  boss.health = 1;
  game.grenades.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, fuse: .01, radius: 6, spin: 0 });
  for (let step = 0; step < 30; step += 1) updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.equal(boss.dead, true, 'босс должен умереть');
  assert.equal(game.doorOpen, true, 'после смерти босса выход открыт');
});

test('ближний бой и выстрелы наносят урон врагу', () => {
  const game = createGame({ seed: 808, locationIndex: 0, slot: 0, upgrades: {} });
  const enemy = game.level.enemies[0];
  game.player.x = enemy.x - 14;
  game.player.y = enemy.y;
  game.player.facing = 0;
  const before = enemy.health;
  updateGame(game, 1 / 60, { move: { x: 0, y: 0 }, melee: true });
  assert.ok(enemy.health < before, 'удар ближнего боя не снял здоровье');

  const shootGame = createGame({ seed: 812, locationIndex: 0, slot: 0, upgrades: {} });
  equipWeapon(shootGame, 'pistol');
  const target = shootGame.level.enemies[0];
  shootGame.player.x = target.x - 60;
  shootGame.player.y = target.y;
  shootGame.player.facing = 0;
  const healthBefore = target.health;
  for (let step = 0; step < 20; step += 1) {
    updateGame(shootGame, 1 / 60, { move: { x: 0, y: 0 }, shoot: true, reload: true });
  }
  assert.ok(target.health < healthBefore, 'выстрел не снял здоровье');
  assert.ok(shootGame.player.magazine < WEAPONS.pistol.magazine, 'магазин не расходуется');
});

test('перезарядка возвращает патроны в магазин', () => {
  const game = createGame({ seed: 1212, locationIndex: 0, slot: 0, upgrades: {} });
  equipWeapon(game, 'pistol');
  game.player.magazine = 0;
  game.player.ammo.pistol = 12;
  for (let step = 0; step < 120; step += 1) updateGame(game, 1 / 60, { move: { x: 0, y: 0 }, reload: true });
  assert.ok(game.player.magazine > 0, 'магазин пуст после перезарядки');
  assert.ok(game.player.ammo.pistol >= 0, 'патроны ушли в минус');
});

test('граната взрывается и опустошает запас', () => {
  const game = createGame({ seed: 1717, locationIndex: 0, slot: 0, upgrades: {} });
  game.player.grenades = 2;
  updateGame(game, 1 / 60, { move: { x: 0, y: 0 }, grenade: true });
  assert.equal(game.player.grenades, 1, 'граната не потрачена');
  assert.equal(game.grenades.length, 1, 'граната не полетела');
  for (let step = 0; step < 120; step += 1) updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.equal(game.grenades.length, 0, 'граната не взорвалась');
  assert.ok(game.particles.length >= 0 && game.decals.length > 0, 'взрыв не оставил следов');
  game.player.grenades = 0;
  updateGame(game, 1 / 60, { move: { x: 0, y: 0 }, grenade: true });
  assert.equal(game.grenades.length, 0, 'граната появилась без запаса');
});

test('аптечка и патроны подбираются', () => {
  const game = createGame({ seed: 1919, locationIndex: 0, slot: 0, upgrades: {} });
  game.player.health = 2;
  game.level.pickups.push({ kind: 'medkit', x: game.player.x + 4, y: game.player.y, bob: 0 });
  for (let step = 0; step < 60; step += 1) updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.ok(game.player.health > 2, 'аптечка не вылечила');

  const ammoGame = createGame({ seed: 2020, locationIndex: 0, slot: 0, upgrades: {} });
  equipWeapon(ammoGame, 'pistol');
  const before = ammoGame.player.ammo.pistol;
  ammoGame.level.pickups.push({ kind: 'ammo', x: ammoGame.player.x + 4, y: ammoGame.player.y, bob: 0 });
  for (let step = 0; step < 60; step += 1) updateGame(ammoGame, 1 / 60, { move: { x: 0, y: 0 } });
  assert.ok(ammoGame.player.ammo.pistol > before, 'патроны не подобрались');
});

test('покупки в магазине меняют состояние игрока', () => {
  const progress = { upgrades: {} };
  const game = createGame({ seed: 33, locationIndex: 0, slot: 0, upgrades: {} });
  game.player.health = 3;
  applyPurchase(game, 'medkit', progress);
  assert.ok(game.player.health > 3, 'аптечка из магазина не лечит');

  applyPurchase(game, 'maxhp', progress);
  assert.equal(progress.upgrades.maxhp, 1);

  applyPurchase(game, 'damage', progress);
  assert.ok(game.player.damageScale > 1, 'заточка не подняла урон');

  applyPurchase(game, 'speed', progress);
  assert.ok(game.player.speed > 76, 'кроссовки не ускорили');

  const grenades = game.player.grenades;
  applyPurchase(game, 'grenade', progress);
  assert.equal(game.player.grenades, grenades + 2);

  const pistol = game.player.ammo.pistol;
  applyPurchase(game, 'ammo_pistol', progress);
  assert.ok(game.player.ammo.pistol > pistol, 'патроны не куплены');
});

test('экипировка оружия забирает патроны из запаса', () => {
  const game = createGame({ seed: 44, locationIndex: 0, slot: 0, upgrades: {} });
  game.player.ammo.pistol = 30;
  equipWeapon(game, 'pistol');
  assert.equal(game.player.gun, 'pistol');
  assert.equal(game.player.magazine, WEAPONS.pistol.magazine);
  assert.equal(game.player.ammo.pistol, 30 - WEAPONS.pistol.magazine);
  equipWeapon(game, 'knife');
  assert.equal(game.player.melee, 'knife');
});

test('линия обзора: стена мешает, дверь не считается целью', () => {
  const game = createGame({ seed: 66, locationIndex: 0, slot: 0, upgrades: {} });
  const door = game.level.door;
  // Ищем проходимую клетку рядом с дверью — коридор может подходить с любой стороны.
  let inFront = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = (door.x + dx) * TILE + TILE / 2, y = (door.y + dy) * TILE + TILE / 2;
    if (!solidAt(game, x, y)) { inFront = { x, y }; break; }
  }
  assert.ok(inFront, 'рядом с дверью нет проходимой клетки');
  assert.equal(lineOfSight(game, inFront.x, inFront.y, door.x * TILE + TILE / 2, door.y * TILE + TILE / 2), false);
  assert.equal(lineOfSight(game, inFront.x, inFront.y, door.x * TILE + TILE / 2, door.y * TILE + TILE / 2, true), true);
  // Сквозь внешнюю стену уровня ничего не видно.
  assert.equal(lineOfSight(game, 8, 8, game.level.w * TILE - 8, game.level.h * TILE - 8), false);
});

test('выход завершает уровень только когда путь открыт', () => {
  const game = createGame({ seed: 77, locationIndex: 0, slot: 0, upgrades: {} });
  game.player.x = game.level.exit.x;
  game.player.y = game.level.exit.y;
  updateGame(game, 1 / 60, { move: { x: 0, y: 0 } });
  assert.equal(game.complete, true, 'на выходе уровень должен завершаться');

  const bossGame = createGame({ seed: 78, locationIndex: 0, slot: LOCATIONS[0].levels - 1, upgrades: {} });
  bossGame.player.x = bossGame.level.exit.x;
  bossGame.player.y = bossGame.level.exit.y;
  updateGame(bossGame, 1 / 60, { move: { x: 0, y: 0 } });
  assert.equal(bossGame.complete, false, 'с живым боссом выход закрыт');
});

test('название этажа включает локацию и номер', () => {
  assert.match(levelTitle(0, 0), /ПОДВАЛ/);
  assert.match(levelTitle(2, 3), /ЭТАЖ 4/);
});

test('progression: апгрейды из сохранения влияют на игрока', () => {
  const plain = createGame({ seed: 99, locationIndex: 0, slot: 0, upgrades: {} });
  const buffed = createGame({ seed: 99, locationIndex: 0, slot: 0, upgrades: { maxhp: 2, speed: 2, damage: 1, grenades: 3 } });
  assert.equal(buffed.player.maxHealth, plain.player.maxHealth + 2);
  assert.ok(buffed.player.speed > plain.player.speed);
  assert.ok(buffed.player.damageScale > plain.player.damageScale);
  assert.ok(buffed.player.grenades > plain.player.grenades);
});
