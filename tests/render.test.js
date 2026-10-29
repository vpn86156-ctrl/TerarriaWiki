/* Рендер: размеры кадра, отсутствие NaN и работа без ошибок на фейковом canvas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resize, renderGame, renderMinimap, viewSize, pixelScale } from '../src/render.js';
import { createGame, updateGame } from '../src/engine.js';
import { installDom, fakeCanvas, drawStats } from './helpers.js';

installDom();

test('resize задаёт согласованные размеры кадра', () => {
  const canvas = fakeCanvas();
  const context = canvas.getContext('2d');
  resize(canvas, context, 915, 412);
  const view = viewSize();
  assert.ok(Number.isFinite(view.w) && Number.isFinite(view.h), 'размер кадра не число');
  assert.ok(view.w > 0 && view.h > 0, 'нулевой кадр');
  assert.equal(canvas.width, view.w);
  assert.equal(canvas.height, view.h);
  assert.equal(view.h, 270, 'внутренняя высота кадра — 270 px');
  assert.ok(view.w >= 351 && view.w <= 702, `ширина под соотношение сторон: ${view.w}`);
  assert.ok(pixelScale() > 1, 'масштаб пикселя больше единицы');
});

test('кадр игры рисуется и не выдаёт NaN в координатах', () => {
  const canvas = fakeCanvas();
  const context = canvas.getContext('2d');
  resize(canvas, context, 915, 412);
  const game = createGame({ seed: 4242, locationIndex: 0, slot: 0, upgrades: {} });
  for (let step = 0; step < 180; step += 1) updateGame(game, 1 / 60, { move: { x: 1, y: .2 }, melee: step % 30 === 0, shoot: step % 45 === 0 });
  const before = { ...drawStats };
  renderGame(context, game, { weapon: game.player.melee });
  assert.ok(drawStats.total - before.total > 100, `слишком мало операций рисования: ${drawStats.total - before.total}`);
  assert.ok(drawStats.gradients >= 2, `свет и виньетка не рисуются: ${drawStats.gradients - before.gradients}`);
});

test('рендер всех трёх локаций и босса проходит без ошибок', () => {
  const canvas = fakeCanvas();
  const context = canvas.getContext('2d');
  resize(canvas, context, 1024, 500);
  for (let loc = 0; loc < 3; loc += 1) {
    const levels = [3, 3, 4][loc];
    for (let slot = 0; slot < levels; slot += 1) {
      const game = createGame({ seed: 100 + loc * 10 + slot, locationIndex: loc, slot, upgrades: {} });
      for (let step = 0; step < 120; step += 1) updateGame(game, 1 / 60, { move: { x: .6, y: -.4 } });
      renderGame(context, game, { weapon: game.player.melee });
      renderMinimap(context, game, 0, 0, 120);
    }
  }
  assert.ok(drawStats.total > 500, `операций рисования: ${drawStats.total}`);
});

test('в рендере нет rgba-строк со слипшейся прозрачностью', () => {
  // Когда-то это давало зелёные квадраты вместо свечений: rgba(120,255,196.16).
  const sources = ['../src/render.js', '../src/main.js', '../src/audio.js'];
  for (const file of sources) {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.ok(!/rgba\(\$\{[^}]*\}\s*\.\d/.test(text), `подозрительная прозрачность в ${file}`);
    for (const match of text.matchAll(/rgba\([^)]*\)/g)) {
      const value = match[0];
      const parts = value.slice(5, -1).split(',');
      assert.ok(parts.length === 3 || parts.length === 4, `неверный цвет: ${value} в ${file}`);
    }
  }
});
