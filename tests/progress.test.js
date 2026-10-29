/* Прогресс: сохранение, чтение, сброс. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress, wipeProgress, defaultSave } from '../src/progress.js';
import { fakeStorage } from './helpers.js';

test('черновик сохранения содержит всё необходимое', () => {
  const data = defaultSave();
  assert.equal(typeof data.coins, 'number');
  assert.ok(data.weapons.includes('crowbar'), 'в стартовом наборе есть лом');
  assert.equal(data.melee, 'crowbar');
  assert.equal(data.gun, 'pistol');
  for (const type of ['pistol', 'shells', 'rifle']) assert.equal(typeof data.ammo[type], 'number', type);
  for (const key of ['damage', 'speed', 'reload', 'luck']) assert.equal(typeof data.upgrades[key], 'number', key);
  for (const key of ['sound', 'music', 'volume', 'shake', 'hints', 'minimap', 'stickSize']) {
    assert.ok(key in data.settings, `настройка ${key}`);
  }
  assert.equal(data.tutorialSeen, false);
});

test('сохранение и чтение — круг без потерь', () => {
  globalThis.localStorage = fakeStorage();
  wipeProgress();
  const fresh = loadProgress();
  fresh.coins = 250;
  fresh.health = 5;
  fresh.weapons = ['crowbar', 'pistol', 'shotgun'];
  fresh.gun = 'shotgun';
  fresh.ammo.shells = 24;
  fresh.upgrades.damage = 3;
  fresh.settings.music = false;
  fresh.stats.kills = 42;
  saveProgress(fresh);

  const loaded = loadProgress();
  assert.equal(loaded.coins, 250);
  assert.equal(loaded.health, 5);
  assert.deepEqual(loaded.weapons, ['crowbar', 'pistol', 'shotgun']);
  assert.equal(loaded.gun, 'shotgun');
  assert.equal(loaded.ammo.shells, 24);
  assert.equal(loaded.ammo.pistol, defaultSave().ammo.pistol, 'остальные патроны не затёрты');
  assert.equal(loaded.upgrades.damage, 3);
  assert.equal(loaded.settings.music, false);
  assert.equal(loaded.stats.kills, 42);
});

test('битые и старые данные не ломают загрузку', () => {
  globalThis.localStorage = fakeStorage();
  globalThis.localStorage.setItem('zabroshka.save.v1', '{это не json');
  const recovered = loadProgress();
  assert.equal(recovered.coins, 0);

  globalThis.localStorage.setItem('zabroshka.save.v1', JSON.stringify({ coins: 10 }));
  const merged = loadProgress();
  assert.equal(merged.coins, 10, 'старые поля сохраняются');
  assert.equal(merged.settings.music, true, 'недостающие поля берутся из defaults');
  assert.ok(merged.stats && merged.upgrades, 'вложенные объекты восстановлены');
});

test('сброс прогресса возвращает чистое сохранение', () => {
  globalThis.localStorage = fakeStorage();
  const data = loadProgress();
  data.coins = 999;
  saveProgress(data);
  const wiped = wipeProgress();
  assert.equal(wiped.coins, 0);
  assert.equal(loadProgress().coins, 0);
});

test('без localStorage игра не падает', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = undefined;
  assert.doesNotThrow(() => saveProgress(defaultSave()));
  assert.doesNotThrow(() => wipeProgress());
  globalThis.localStorage = original;
});
