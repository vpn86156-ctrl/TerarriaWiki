#!/usr/bin/env python3
"""Добавляет CC0-звуки из open-game-sfx-index в библиотеку игры.

Источник: github.com/Legerdo/open-game-sfx-index (лицензия CC0 1.0).
Клон репозитория передаётся первым аргументом, например:

    .local/venv/bin/python scripts/import-sfx.py /tmp/sfxidx

Звук попадает в группу по ключевым словам в имени файла; группы совпадают
с теми, что ждёт движок (src/audio.js): swing, hit, gun, boom, step, door,
pickup, growl, hurt, click, reload, ambient. Внутри группы движок играет
случайный файл, поэтому чем больше файлов — тем разнообразнее звук.
Слишком длинные сэмплы отбрасываются: они забивают память телефона.
"""

import json
import os
import re
import shutil
import sys
from collections import defaultdict

import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'public', 'audio', 'sfx')
MANIFEST = os.path.join(ROOT, 'public', 'audio', 'manifest.json')
LICENSE = 'CC0 1.0'
SOURCE = 'open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)'

# Порядок важен: первое совпадение выигрывает.
GROUPS = [
    ('boom', ['explosion', 'explode', 'boom', 'blast', 'grenade', 'bomb', 'detonate']),
    ('gun', ['gun', 'shot', 'shoot', 'pistol', 'rifle', 'shotgun', 'bullet', 'laser', 'fire']),
    ('swing', ['swish', 'swoosh', 'whoosh', 'swing', 'slash', 'blade', 'whip', 'miss']),
    ('hit', ['hit', 'punch', 'smash', 'thud', 'impact', 'strike', 'knock', 'bang', 'slap']),
    ('step', ['step', 'foot', 'walk', 'run', 'boot', 'gravel', 'dirt', 'concrete', 'sneak']),
    ('door', ['door', 'gate', 'hatch', 'lock', 'latch', 'creak', 'open', 'close']),
    ('pickup', ['coin', 'pickup', 'collect', 'item', 'powerup', 'key', 'charm', 'sparkle', 'gem']),
    ('growl', ['growl', 'monster', 'roar', 'zombie', 'creature', 'beast', 'snarl', 'breath', 'gasp']),
    ('hurt', ['pain', 'hurt', 'damage', 'ouch', 'groan', 'whimper', 'injur']),
    ('click', ['click', 'button', 'select', 'blip', 'beep', 'menu', 'switch', 'confirm']),
    ('reload', ['reload', 'cock', 'clack', 'bolt', 'magazine', 'ratchet', 'mechanism']),
    ('ambient', ['ambient', 'wind', 'drip', 'hum', 'machine', 'water', 'cave', 'room', 'loop']),
]
MAX_DURATION = {'ambient': 9.0}
DEFAULT_MAX_DURATION = 3.0


def group_for(name):
    low = name.lower()
    for group, words in GROUPS:
        if any(word in low for word in words):
            return group
    return None


def title_from(name):
    base = os.path.splitext(name)[0]
    return re.sub(r'[_\-]+', ' ', base).strip()


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sfxidx'
    audio = os.path.join(source, 'audio')
    if not os.path.isdir(audio):
        print(f'нет папки {audio}')
        return 1
    with open(MANIFEST, encoding='utf-8') as handle:
        manifest = json.load(handle)
    known = {entry['file'] for entry in manifest['sfx']}
    counters = defaultdict(int)
    for entry in manifest['sfx']:
        match = re.match(r'([a-z]+)-(\d+)\.ogg$', entry['file'])
        if match:
            counters[match.group(1)] = max(counters[match.group(1)], int(match.group(2)))

    added = defaultdict(int)
    bytes_added = 0
    for pack in sorted(os.listdir(audio)):
        folder = os.path.join(audio, pack)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if not name.endswith('.ogg'):
                continue
            group = group_for(name)
            if not group:
                continue
            path = os.path.join(folder, name)
            try:
                info = sf.info(path)
            except Exception:
                continue
            if info.duration > MAX_DURATION.get(group, DEFAULT_MAX_DURATION):
                continue
            counters[group] += 1
            target = f'{group}-{counters[group]:02d}.ogg'
            if target in known:
                continue
            shutil.copyfile(path, os.path.join(TARGET, target))
            known.add(target)
            manifest['sfx'].append({
                'file': target,
                'group': group,
                'title': title_from(name),
                'pack': pack,
                'duration': round(info.duration, 3),
                'license': LICENSE,
                'source': SOURCE,
            })
            added[group] += 1
            bytes_added += os.path.getsize(path)

    manifest['sfx'].sort(key=lambda entry: (entry['group'], entry['file']))
    manifest['note'] = (f'{len(manifest["sfx"])} звуков CC0 и {len(manifest["music"])} '
                        'музыкальных треков CC0.')
    with open(MANIFEST, 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=1)

    print(f'добавлено: {sum(added.values())} файлов, {bytes_added / 1e6:.1f} МБ')
    for group, count in sorted(added.items(), key=lambda kv: -kv[1]):
        print(f'  {group:8} +{count}')
    print(f'всего звуков в манифесте: {len(manifest["sfx"])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
