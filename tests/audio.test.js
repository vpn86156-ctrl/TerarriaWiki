/* Звук: настройки, разбор списка файлов, устойчивость без AudioContext. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AudioEngine, SFX_GROUPS } from '../src/audio.js';

test('без звукового контекста ничего не падает', () => {
  const engine = new AudioEngine();
  engine.settings = { sound: true, music: true, volume: .8 };
  assert.doesNotThrow(() => engine.play('gun'));
  assert.doesNotThrow(() => engine.footsteps(1 / 60, true));
  assert.doesNotThrow(() => engine.configure({ music: false }));
  assert.doesNotThrow(() => engine.stopMusic());
  assert.doesNotThrow(() => engine.suspend());
  assert.doesNotThrow(() => engine.resume());
  assert.equal(engine.context, null);
});

test('настройки объединяются, а не затираются', () => {
  const engine = new AudioEngine();
  engine.configure({ volume: .3 });
  assert.equal(engine.settings.volume, .3);
  assert.equal(engine.settings.sound, true, 'остальные флаги не сброшены');
  engine.configure({ sound: false, music: false });
  assert.equal(engine.settings.volume, .3);
  assert.equal(engine.settings.sound, false);
  assert.equal(engine.settings.music, false);
});

test('выключенный звук не играет эффекты', () => {
  const engine = new AudioEngine();
  engine.configure({ sound: false });
  let synth = 0;
  engine.synth = () => { synth += 1; };
  engine.context = {}; // как будто контекст есть
  engine.play('swing');
  assert.equal(synth, 0, 'при выключенном звуке тишина');
});

test('шаги идут с интервалом, а не каждый кадр', () => {
  const engine = new AudioEngine();
  let steps = 0;
  engine.context = null;
  engine.play = (group) => { if (group === 'step') steps += 1; };
  for (let frame = 0; frame < 120; frame += 1) engine.footsteps(1 / 60, true);
  assert.ok(steps >= 4 && steps <= 6, `шагов за 2 секунды: ${steps}`);
  engine.footsteps(1 / 60, false);
  assert.equal(engine.stepTimer, 0, 'на месте шаги не идут');
});

test('все группы звуков из кода есть в манифесте сборки', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
  const groups = new Set(manifest.sfx.map((entry) => entry.group));
  for (const group of SFX_GROUPS) assert.ok(groups.has(group), `нет звуков для группы ${group}`);
  assert.ok(manifest.sfx.length >= 60, `звуков в манифесте: ${manifest.sfx.length}`);
  for (const entry of manifest.sfx) {
    assert.match(entry.file, /\.ogg$/, entry.file);
    assert.equal(entry.license, 'CC0 1.0', 'лицензия звука');
    assert.ok(entry.source.length > 5, 'источник звука');
  }
});

test('музыка разложена по ролям и подписана', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
  const roles = new Set(manifest.music.map((track) => track.role));
  for (const role of ['explore', 'fight', 'boss']) assert.ok(roles.has(role), `нет музыки для роли ${role}`);
  for (const track of manifest.music) {
    // Треки бывают двух форматов: скачанные MP3 и наши собственные OGG.
    assert.match(track.file, /\.(mp3|ogg)$/, track.file);
    assert.ok(track.license.startsWith('CC0'), `лицензия трека ${track.file}`);
    assert.ok(track.title.length > 2, 'название трека');
    assert.ok(track.source.length > 2, 'источник трека');
  }
});

test('все файлы из манифеста реально лежат в проекте', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8'));
  for (const entry of manifest.sfx) {
    assert.doesNotThrow(
      () => readFileSync(new URL(`../public/audio/sfx/${entry.file}`, import.meta.url)),
      `нет файла ${entry.file}`,
    );
  }
  for (const track of manifest.music) {
    assert.doesNotThrow(
      () => readFileSync(new URL(`../public/audio/music/${track.file}`, import.meta.url)),
      `нет файла ${track.file}`,
    );
  }
});
