/* Общие helpers для тестов: фейковый canvas и localStorage. */

// Общий счётчик: рендер рисует и на внеэкранных画布х, их тоже считаем.
export const drawStats = { total: 0, gradients: 0 };

// Минимальная «рисовалка»: принимает любые вызовы 2D-контекста и считает их.
export function fakeContext() {
  const calls = drawStats;
  const gradient = {
    addColorStop: () => { calls.total += 1; },
  };
  const handler = {
    get(target, property) {
      if (property === '__calls') return calls;
      if (property === 'canvas') return target.canvas;
      if (property in target) return target[property];
      return (...args) => {
        calls.total += 1;
        for (const value of args) {
          if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new Error(`non-finite argument in ctx.${String(property)}: ${args.join(', ')}`);
          }
        }
        if (property === 'createRadialGradient' || property === 'createLinearGradient') {
          calls.gradients += 1;
          return gradient;
        }
        if (property === 'getImageData') {
          return { data: new Uint8ClampedArray(4) };
        }
        return undefined;
      };
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  };
  return new Proxy({ calls }, handler);
}

export function fakeCanvas(width = 640, height = 270) {
  const context = fakeContext();
  return {
    width, height,
    getContext: () => context,
    style: {},
  };
}

export function installDom() {
  const created = [];
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error(`unexpected createElement(${tag})`);
      const canvas = fakeCanvas();
      created.push(canvas);
      return canvas;
    },
  };
  globalThis.window = globalThis.window || { devicePixelRatio: 1 };
  return { created };
}

export function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    clear: () => map.clear(),
    get size() { return map.size; },
  };
}

// BFS по проходимым клеткам — проверяет, что до цели можно дойти.
export function reachableTiles(game, { withDoor = false } = {}) {
  const level = game.level;
  const startX = Math.floor(game.player.x / 16);
  const startY = Math.floor(game.player.y / 16);
  const seen = new Set([startY * level.w + startX]);
  const queue = [{ x: startX, y: startY }];
  while (queue.length) {
    const node = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = node.x + dx, y = node.y + dy;
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
      const tile = level.grid[y * level.w + x];
      if (tile === 0 || tile === 2) continue;
      if (tile === 3 && !withDoor) continue;
      const key = y * level.w + x;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}
