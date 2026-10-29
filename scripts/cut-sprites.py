#!/usr/bin/env python3
"""Нарезка пиксельных спрайтов «Заброшки» из исходных картинок.

Правила простые:
  * art-source/floor-*.png — сетка 2×2, получаются floor-<loc>-0..3;
  * art-source/grid-<name>-<cols>x<rows>.png — сетка указанного размера;
  * любой другой PNG — один спрайт, имя файла становится именем спрайта.

Фон исходников — маджента (#FF00FF, в реальности около (251,2,251)),
поэтому допуск по каждому каналу: пиксель считается фоном, если он близок
к мадженте сразу по R, G и B.

RGB и альфа обрабатываются РАЗДЕЛЬНО: иначе квантование цвета затирает
маску и на выходе получаются полностью прозрачные файлы.
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art-source'
TARGET = ROOT / 'public' / 'images' / 'sprites'
BACKGROUND = (251, 2, 251)
TOLERANCE = 90

# Имя спрайта → сторона квадрата на выходе.
SIZES = [
    (r'^floor-', 16), (r'^wall-', 16), (r'^door-', 16), (r'^exit-', 16),
    (r'^decal-', 16), (r'^grate-', 16), (r'^vent-', 16),
    (r'^item-', 14), (r'^weapon-', 18),
    (r'^boss-', 64),
]


def size_for(name):
    for pattern, size in SIZES:
        if re.match(pattern, name):
            return size
    return 24  # герой, враги, реквизит


def background_mask(image):
    """Маска «это не фон»: 255 — сам спрайт, 0 — маджента."""
    rgb = image.convert('RGB')
    width, height = rgb.size
    pixels = rgb.tobytes()
    mask = Image.new('L', (width, height))
    data = bytearray(width * height)
    index = 0
    for position in range(0, len(pixels), 3):
        r, g, b = pixels[position], pixels[position + 1], pixels[position + 2]
        close = (abs(r - BACKGROUND[0]) <= TOLERANCE
                 and abs(g - BACKGROUND[1]) <= TOLERANCE
                 and abs(b - BACKGROUND[2]) <= TOLERANCE)
        data[index] = 0 if close else 255
        index += 1
    mask.frombytes(bytes(data))
    return mask


def clean(mask, threshold=96):
    """Убирает бахрому по краям: полупрозрачные пиксели превращаются в ч/б."""
    return mask.point(lambda value: 255 if value > threshold else 0)


def cut_cell(image, size):
    """Вырезает один спрайт из картинки и приводит его к size×size."""
    rgb = image.convert('RGB')
    mask = background_mask(image)
    box = mask.getbbox()
    if box is None:
        return None
    crop_rgb = rgb.crop(box)
    crop_mask = mask.crop(box)
    width, height = crop_rgb.size
    side = max(width, height)
    # Квадратная канва, спрайт стоит по центру нижней части кадра.
    canvas_rgb = Image.new('RGB', (side, side), (0, 0, 0))
    canvas_rgb.paste(crop_rgb, ((side - width) // 2, (side - height) // 2))
    canvas_mask = Image.new('L', (side, side), 0)
    canvas_mask.paste(crop_mask, ((side - width) // 2, (side - height) // 2))
    # Масштабирование: BOX даёт ровный пиксельный результат без мыла.
    scaled_rgb = canvas_rgb.resize((size, size), Image.BOX)
    scaled_mask = clean(canvas_mask.resize((size, size), Image.BOX))
    # Ограниченная палитра — настоящий 16-битный вид, но только по цвету.
    quantized = scaled_rgb.quantize(colors=48, method=Image.FASTOCTREE).convert('RGB')
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(quantized, (0, 0))
    result.putalpha(scaled_mask)
    opaque = sum(1 for value in scaled_mask.tobytes() if value > 128)
    fill = opaque / float(size * size)
    return result, fill


def split_grid(image, cols, rows):
    width, height = image.size
    cell_w, cell_h = width // cols, height // rows
    for row in range(rows):
        for col in range(cols):
            yield image.crop((col * cell_w, row * cell_h,
                              (col + 1) * cell_w, (row + 1) * cell_h))


def write(name, sprite, fill, manifest, warn):
    if sprite is None:
        warn.append(f'{name}: пусто, пропущен')
        return
    if fill < 0.05:
        warn.append(f'{name}: почти пусто ({fill:.0%})')
    path = TARGET / f'{name}.png'
    sprite.save(path, optimize=True)
    manifest[name] = {'file': path.name, 'size': sprite.size[0], 'fill': round(fill, 3)}


def main():
    if not SOURCE.exists():
        print(f'нет папки {SOURCE}')
        return 1
    TARGET.mkdir(parents=True, exist_ok=True)
    for stale in TARGET.glob('*.png'):
        stale.unlink()
    manifest = {}
    warn = []
    files = sorted(p for p in SOURCE.glob('*.png'))
    for path in files:
        stem = path.stem
        image = Image.open(path)
        grid = re.search(r'-(\d)x(\d)$', stem)
        if stem.startswith('floor-'):
            names = [f'{stem}-{index}' for index in range(4)]
            for name, cell in zip(names, split_grid(image, 2, 2)):
                result = cut_cell(cell, size_for(name))
                write(name, result[0] if result else None,
                      result[1] if result else 0, manifest, warn)
            continue
        if grid:
            base = stem[: grid.start()]
            cols, rows = int(grid.group(1)), int(grid.group(2))
            for index, cell in enumerate(split_grid(image, cols, rows)):
                name = f'{base}-{index}'
                result = cut_cell(cell, size_for(name))
                write(name, result[0] if result else None,
                      result[1] if result else 0, manifest, warn)
            continue
        result = cut_cell(image, size_for(stem))
        write(stem, result[0] if result else None,
              result[1] if result else 0, manifest, warn)
    (TARGET / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True), encoding='utf-8')
    print(f'спрайтов: {len(manifest)}')
    for line in warn:
        print('ПРЕДУПРЕЖДЕНИЕ', line)
    empties = [name for name, meta in manifest.items() if meta['fill'] < 0.05]
    print(f'пустых: {len(empties)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
