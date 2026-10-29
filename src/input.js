/* Управление: виртуальный джойстик слева, четыре кнопки справа.
   В браузере на компьютере работают те же действия с клавиатуры. */

export class TouchControls {
  constructor() {
    this.state = { move: { x: 0, y: 0 }, melee: false, shoot: false, reload: false, grenade: false };
    this.joystick = null;
    this.pointer = null;
    this.keys = new Set();
    this.onFirstInput = null;
    this.firstDone = false;
  }

  firstInput() {
    if (this.firstDone) return;
    this.firstDone = true;
    this.onFirstInput?.();
  }

  attach({ stick, buttons }) {
    this.stick = stick;
    const knob = stick.querySelector('.stick-knob');
    const startStick = (event) => {
      this.firstInput();
      const rect = stick.getBoundingClientRect();
      this.pointer = { id: event.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, r: rect.width / 2 };
      stick.setPointerCapture(event.pointerId);
      stick.classList.add('active');
      moveStick(event);
    };
    const moveStick = (event) => {
      if (!this.pointer || event.pointerId !== this.pointer.id) return;
      let dx = (event.clientX - this.pointer.cx) / this.pointer.r;
      let dy = (event.clientY - this.pointer.cy) / this.pointer.r;
      const length = Math.hypot(dx, dy) || 0;
      const clamped = Math.min(1, length);
      if (length > 0) { dx = (dx / length) * clamped; dy = (dy / length) * clamped; }
      this.state.move.x = dx;
      this.state.move.y = dy;
      const radius = this.pointer.r * .45;
      knob.style.transform = `translate(${dx * radius}px, ${dy * radius}px)`;
      this.joystick = { x: dx, y: dy, active: true };
    };
    const endStick = (event) => {
      if (!this.pointer || event.pointerId !== this.pointer.id) return;
      this.pointer = null;
      this.state.move.x = 0;
      this.state.move.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
      stick.classList.remove('active');
    };
    this.moveStick = moveStick;
    stick.addEventListener('pointerdown', startStick);
    stick.addEventListener('pointermove', moveStick);
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    stick.addEventListener('lostpointercapture', endStick);

    for (const button of buttons) {
      const action = button.dataset.action;
      const press = (event) => {
        event.preventDefault();
        this.firstInput();
        if (action === 'grenade') this.state.grenade = true;
        else this.state[action] = true;
        button.classList.add('pressed');
      };
      const release = (event) => {
        event.preventDefault();
        if (action !== 'grenade') this.state[action] = false;
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    window.addEventListener('keydown', (event) => {
      this.firstInput();
      this.keys.add(event.code);
      this.syncKeys();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.syncKeys();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.syncKeys(); });
  }

  syncKeys() {
    const held = (...codes) => codes.some((code) => this.keys.has(code));
    let x = 0, y = 0;
    if (held('KeyA', 'ArrowLeft')) x -= 1;
    if (held('KeyD', 'ArrowRight')) x += 1;
    if (held('KeyW', 'ArrowUp')) y -= 1;
    if (held('KeyS', 'ArrowDown')) y += 1;
    if (x || y) {
      const length = Math.hypot(x, y);
      this.state.move.x = x / length;
      this.state.move.y = y / length;
    } else if (!this.pointer) {
      this.state.move.x = 0;
      this.state.move.y = 0;
    }
    this.state.melee = held('KeyJ', 'Space');
    this.state.shoot = held('KeyK', 'KeyE');
    this.state.reload = held('KeyR');
    if (held('KeyG') && !this.gKeyHeld) this.state.grenade = true;
    this.gKeyHeld = held('KeyG');
  }

  release() {
    this.state.move.x = 0;
    this.state.move.y = 0;
    this.state.melee = false;
    this.state.shoot = false;
    this.state.reload = false;
    this.state.grenade = false;
  }
}
