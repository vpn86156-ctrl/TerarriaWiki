import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// A missing export only fails at runtime in the browser, so the suite checks every import statically.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = ['src', 'tests', 'scripts'].flatMap((dir) => readdirSync(resolve(root, dir))
  .filter((name) => /\.(js|mjs)$/.test(name))
  .map((name) => resolve(root, dir, name)));

const EXPORTS = /(?:^|\n)\s*export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)|export\s*\{([^}]*)\}/g;

function exportedNames(file) {
  const text = readFileSync(file, 'utf8');
  const names = new Set();
  for (const match of text.matchAll(EXPORTS)) {
    if (match[1]) names.add(match[1]);
    if (match[2]) {
      for (const part of match[2].split(',')) {
        const alias = part.trim().split(/\s+as\s+/).pop().trim();
        if (alias && alias !== 'default') names.add(alias);
      }
    }
  }
  return names;
}

test('every named import resolves to a real export', () => {
  const cache = new Map();
  const problems = [];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))?\s*from\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[4];
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(file), specifier);
      if (!cache.has(target)) cache.set(target, exportedNames(target));
      const names = cache.get(target);
      const imported = (match[2] || '').split(',').map((part) => part.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      for (const name of imported) {
        if (!names.has(name)) problems.push(`${relative(root, file)} imports "${name}" from ${relative(root, target)}, which does not export it`);
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

// `rgba(${palette.tint}.16)` reads as an opaque rgb() colour in Chrome and paints a solid square
// instead of a glow, so every tint-based colour must put the alpha behind a comma.
test('every colour built from a biome tint separates the alpha with a comma', () => {
  const offenders = [];
  for (const file of sources.filter((path) => path.includes('/src/'))) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(/tint\}(.?)/g)) {
        if (match[1] !== ',') offenders.push(`${relative(root, file)}:${index + 1} -> "tint}${match[1]}"`);
      }
    });
  }
  assert.deepEqual(offenders, [], `alpha must follow a comma: ${offenders.join(', ')}`);
});

test('the source tree has no leftover debug output', () => {
  const offenders = [];
  for (const file of sources.filter((path) => path.includes('/src/'))) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, index) => {
      if (/console\.(log|debug|warn)\(/.test(line) && !line.trim().startsWith('//')) {
        offenders.push(`${relative(root, file)}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `debug logging left in src: ${offenders.join(', ')}`);
});
