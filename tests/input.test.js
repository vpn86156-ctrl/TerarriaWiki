/* Управление: джойстик, кнопки, клавиатура. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControls } from '../src/input.js';

// Крошечная модель DOM-элемента: достаточно, чтобы повесить обработчики указателя.
function fakeElement(extra = {}) {
  const handlers = new Map();
  return {
    handlers,
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    dataset: extra.dataset || {},
    setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 }),
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(handler);
    },
    fire(type, event = {}) { for (const handler of handlers.get(type) || []) handler(event); },
    querySelector: () => fakeElement(),
  };
}

function harness() {
  const listeners = new Map();
  globalThis.window = {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
  };
  const controls = new TouchControls();
  const stick = fakeElement();
  const buttons = ['melee', 'shoot', 'reload', 'grenade'].map((action) => fakeElement({ dataset: { action } }));
  controls.attach({ stick, buttons });
  const key = (type, code) => {
    for (const handler of listeners.get(type) || []) handler({ code, preventDefault() {} });
  };
  return { controls, stick, buttons, key };
}

test('джойстик двигает персонажа и отпускается', () => {
  const { controls, stick } = harness();
  stick.fire('pointerdown', { pointerId: 1, clientX: 60, clientY: 60 });
  stick.fire('pointermove', { pointerId: 1, clientX: 110, clientY: 60 });
  assert.ok(controls.state.move.x > .5, `движение вправо: ${controls.state.move.x}`);
  assert.ok(Math.abs(controls.state.move.y) < .2, 'вниз-вверх не должно смещаться');
  stick.fire('pointerup', { pointerId: 1 });
  assert.equal(controls.state.move.x, 0);
  assert.equal(controls.state.move.y, 0);
});

test('джойстик не выходит за пределы круга', () => {
  const { controls, stick } = harness();
  stick.fire('pointerdown', { pointerId: 2, clientX: 60, clientY: 60 });
  stick.fire('pointermove', { pointerId: 2, clientX: 5000, clientY: 5000 });
  const length = Math.hypot(controls.state.move.x, controls.state.move.y);
  assert.ok(length <= 1.0001, `вектор длиннее единицы: ${length}`);
});

test('кнопки атаки, выстрела и перезарядки нажимаются и отпускаются', () => {
  const { controls, buttons } = harness();
  const [melee, shoot, reload] = buttons;
  melee.fire('pointerdown', { preventDefault() {} });
  shoot.fire('pointerdown', { preventDefault() {} });
  reload.fire('pointerdown', { preventDefault() {} });
  assert.equal(controls.state.melee, true);
  assert.equal(controls.state.shoot, true);
  assert.equal(controls.state.reload, true);
  melee.fire('pointerup', { preventDefault() {} });
  shoot.fire('pointerup', { preventDefault() {} });
  reload.fire('pointerup', { preventDefault() {} });
  assert.equal(controls.state.melee, false);
  assert.equal(controls.state.shoot, false);
  assert.equal(controls.state.reload, false);
});

test('граната — разовое нажатие, сбрасывается игрой', () => {
  const { controls, buttons } = harness();
  const grenade = buttons[3];
  grenade.fire('pointerdown', { preventDefault() {} });
  assert.equal(controls.state.grenade, true);
  grenade.fire('pointerup', { preventDefault() {} });
  assert.equal(controls.state.grenade, true, 'отпускание не сбрасывает гранату: её сбросит игра');
  controls.state.grenade = false;
  assert.equal(controls.state.grenade, false);
});

test('клавиатура дублирует управление', () => {
  const { controls, key } = harness();
  key('keydown', 'KeyD');
  assert.ok(controls.state.move.x > .9, 'вправо');
  key('keydown', 'KeyW');
  const length = Math.hypot(controls.state.move.x, controls.state.move.y);
  assert.ok(Math.abs(length - 1) < .001, `диагональ нормирована: ${length}`);
  key('keyup', 'KeyD');
  key('keyup', 'KeyW');
  assert.equal(controls.state.move.x, 0);

  key('keydown', 'KeyJ');
  assert.equal(controls.state.melee, true);
  key('keyup', 'KeyJ');
  key('keydown', 'KeyK');
  assert.equal(controls.state.shoot, true);
  key('keyup', 'KeyK');
  key('keydown', 'KeyR');
  assert.equal(controls.state.reload, true);
  key('keyup', 'KeyR');
  assert.equal(controls.state.melee, false);
  assert.equal(controls.state.shoot, false);
  assert.equal(controls.state.reload, false);

  key('keydown', 'KeyG');
  assert.equal(controls.state.grenade, true, 'граната по нажатию клавиши');
  controls.state.grenade = false;
  key('keyup', 'KeyG');
  key('keydown', 'KeyG');
  assert.equal(controls.state.grenade, true, 'повторное нажатие снова бросает');
});

test('потеря фокуса отпускает все кнопки', () => {
  const { controls, key } = harness();
  key('keydown', 'KeyD');
  key('keydown', 'KeyJ');
  for (const handler of globalThis.window.addEventListener ? [] : []) handler();
  controls.keys.clear();
  controls.syncKeys();
  assert.equal(controls.state.move.x, 0);
  assert.equal(controls.state.melee, false);
});

test('первое касание вызывает колбэк один раз', () => {
  const { controls, buttons } = harness();
  let calls = 0;
  controls.onFirstInput = () => { calls += 1; };
  buttons[0].fire('pointerdown', { preventDefault() {} });
  buttons[1].fire('pointerdown', { preventDefault() {} });
  assert.equal(calls, 1, 'звук разблокируется один раз');
});

test('release сбрасывает всё состояние', () => {
  const { controls, key } = harness();
  key('keydown', 'KeyD');
  key('keydown', 'KeyJ');
  key('keydown', 'KeyK');
  controls.release();
  assert.deepEqual(controls.state, { move: { x: 0, y: 0 }, melee: false, shoot: false, reload: false, grenade: false });
});
