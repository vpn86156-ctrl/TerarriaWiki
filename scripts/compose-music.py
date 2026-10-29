#!/usr/bin/env python3
"""Процедурный композитор музыки «Заброшки».

Пишет OGG/Vorbis прямо в public/audio/music. Музыка не скачана ниоткуда —
она синтезируется здесь, поэтому вопросов с лицензией не возникает:
эти треки можно считать CC0.

Три роли, которые ждёт игра:
  explore — тихий мрачный дрон с редкими каплями и шорохами;
  fight   — ритмичный индастриал: кик, снэр, бас-рифф, металлические звоны;
  boss    — тяжёлый хорал с ударами молота и нарастающим напряжением.

Каждый трек собирается из MIDI-ног, гамм и простых огибающих, затем
сводится в стерео и слегка «окунается» в реверб (свёртка с затухающим шумом).
"""

import json
import os
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, 'public', 'audio', 'music')
MANIFEST = os.path.join(ROOT, 'public', 'audio', 'manifest.json')
RATE = 44100

# Натуральный минор и фригийский — подходяще мрачные лады.
SCALES = {
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
}
CHORDS = {'minor': [0, 3, 7], 'phrygian': [0, 3, 7]}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def envelope(length, attack, decay, sustain, release, hold):
    """Простая ADSR-огибающая заданной длины."""
    total = attack + decay + hold + release
    if length < total:
        scale = length / total
        attack, decay, hold, release = (v * scale for v in (attack, decay, hold, release))
    attack_n = max(1, int(attack * RATE))
    decay_n = max(1, int(decay * RATE))
    hold_n = max(1, int(hold * RATE))
    release_n = max(1, int(release * RATE))
    parts = [
        np.linspace(0, 1, attack_n),
        np.linspace(1, sustain, decay_n),
        np.full(hold_n, sustain),
        np.linspace(sustain, 0, release_n),
    ]
    wave = np.concatenate(parts)
    if len(wave) < length:
        wave = np.pad(wave, (0, length - len(wave)))
    return wave[:length]


def oscillator(frequency, length, kind='sine', detune=0.0, phase=0.0):
    t = np.arange(length) / RATE
    frequency = frequency * (1 + detune)
    if kind == 'sine':
        return np.sin(2 * np.pi * frequency * t + phase)
    if kind == 'triangle':
        return 2 * np.abs(2 * (frequency * t + phase / (2 * np.pi) % 1) - 1) - 1
    if kind == 'saw':
        return 2 * ((frequency * t + phase / (2 * np.pi)) % 1) - 1
    if kind == 'square':
        return np.sign(np.sin(2 * np.pi * frequency * t + phase))
    return np.zeros(length)


def noise(length, seed):
    rng = np.random.default_rng(seed)
    return rng.uniform(-1, 1, length)


def lowpass(signal, cutoff, resonance=0.0):
    """Фильтр нижних частот: короткая FIR-свёртка с экспоненциальным ядром."""
    taps = 64
    t = np.arange(taps)
    kernel = np.exp(-2 * np.pi * cutoff * t / RATE)
    kernel /= kernel.sum()
    out = np.convolve(signal, kernel, mode='same')
    if resonance:
        out = out + resonance * np.convolve(out, kernel, mode='same') * 0.5
    return out


def reverb(signal, amount=0.25, seconds=1.8, seed=7):
    """Реверб как свёртка с затухающим шумом: БПФ по блокам (overlap-add),
    чтобы не выделять гигантские массивы на целый трек."""
    tail_len = max(1, int(seconds * RATE))
    tail = noise(tail_len, seed) * np.linspace(1, 0, tail_len) ** 2.2
    block = 1 << 16
    fft_size = 1 << (block + tail_len - 1).bit_length()
    tail_fft = np.fft.rfft(tail, fft_size)
    wet = np.zeros(len(signal) + tail_len)
    for start in range(0, len(signal), block):
        chunk = signal[start:start + block]
        conv = np.fft.irfft(np.fft.rfft(chunk, fft_size) * tail_fft)
        end = min(len(conv), len(wet) - start)
        wet[start:start + end] += conv[:end]
    wet = wet[: len(signal)]
    wet = wet / (np.max(np.abs(wet)) + 1e-9)
    return signal * (1 - amount) + wet * amount


def place(canvas, start, signal, gain=1.0, pan=0.0):
    """Кладёт моно-сигнал в стерео-канву с панорамой и громкостью."""
    start = int(start * RATE)
    if start >= canvas.shape[1]:
        return
    end = min(canvas.shape[1], start + len(signal))
    length = end - start
    left = gain * (1 - max(0.0, pan))
    right = gain * (1 - max(0.0, -pan))
    canvas[0, start:end] += signal[:length] * left
    canvas[1, start:end] += signal[:length] * right


def note(length, midi, kind='sine', detune=0.0, attack=0.01, decay=0.12,
         sustain=0.65, release=0.25, hold=0.1, gain=0.5, seed=1):
    total = int(length * RATE)
    wave = oscillator(hz(midi), total, kind, detune)
    if kind in ('saw', 'square'):
        wave += 0.35 * oscillator(hz(midi), total, kind, detune + 0.004)
        wave = lowpass(wave * 0.7, 2200)
    env = envelope(total, attack, decay, sustain, release, hold)
    return wave * env * gain


def compose(role, seed, minutes=2.0):
    rng = np.random.default_rng(seed)
    scale = rng.choice(list(SCALES))
    steps = SCALES[scale]
    root = int(rng.choice([33, 35, 36, 38]))  # низкий, мрачный строй
    beats = 60.0 / (62 if role == 'explore' else 138 if role == 'fight' else 96)
    bars = int(minutes * 60 / (beats * 4))
    total = int(minutes * 60) + 4
    canvas = np.zeros((2, int(total * RATE)))

    def degree(index, octave=0):
        step = steps[index % len(steps)]
        return root + step + 12 * (index // len(steps)) + 12 * octave

    for bar in range(bars):
        at = bar * beats * 4
        chord = [degree(int(rng.integers(0, 7)) + offset) for offset in (0, 2, 4)]
        if role == 'explore':
            # Дрон: три детюненных голоса на весь такт.
            for voice, midi in enumerate(chord):
                length = beats * 4
                signal = note(length, midi, 'sine', detune=(voice - 1) * 0.003,
                              attack=0.8, decay=0.6, sustain=0.8, release=1.2,
                              hold=length - 2.6, gain=0.16)
                place(canvas, at, signal, pan=(voice - 1) * 0.35)
            # Редкие капли и шорох.
            if bar % 2 == 0:
                drop_at = at + beats * float(rng.integers(0, 4))
                drop = note(0.8, degree(int(rng.integers(7, 14))), 'sine',
                            attack=0.005, decay=0.25, sustain=0.1, release=0.5,
                            hold=0.02, gain=0.12)
                place(canvas, drop_at, drop, pan=float(rng.uniform(-0.6, 0.6)))
            if rng.random() < 0.4:
                hiss = lowpass(noise(int(beats * RATE), seed + bar), 700) * 0.05
                place(canvas, at + beats * 2, hiss, pan=float(rng.uniform(-0.5, 0.5)))
            if bar % 4 == 0:
                thud = note(1.2, root - 12, 'sine', attack=0.005, decay=0.4,
                            sustain=0.0, release=0.6, hold=0.05, gain=0.22)
                place(canvas, at, thud)
        elif role == 'fight':
            # Барабанный рисунок: кик на 1 и 3, снэр на 2 и 4.
            for beat in (0, 2):
                kick = note(0.35, root - 24, 'sine', attack=0.002, decay=0.12,
                            sustain=0.05, release=0.18, hold=0.02, gain=0.55)
                place(canvas, at + beat * beats, kick)
            for beat in (1, 3):
                length = int(0.22 * RATE)
                snare = noise(length, seed + bar * 7 + beat) * envelope(
                    length, 0.002, 0.08, 0.2, 0.12, 0.01)
                snare = snare - np.convolve(snare, np.ones(64) / 64, mode='same') * 0.4
                place(canvas, at + beat * beats, snare * 0.35, pan=0.15)
            # Бас-рифф восьмыми.
            for eighth in range(8):
                midi = root - 12 + steps[(eighth // 2 + bar) % len(steps)]
                bass = note(0.24, midi, 'saw', attack=0.005, decay=0.08,
                            sustain=0.5, release=0.12, hold=0.03, gain=0.24)
                place(canvas, at + eighth * beats / 2, bass)
            # Стаккато-аккорд на слабую долю.
            for voice, midi in enumerate(chord):
                stab = note(0.2, midi + 12, 'square', attack=0.004, decay=0.07,
                            sustain=0.25, release=0.1, hold=0.02, gain=0.09)
                place(canvas, at + beats * 1.5, stab, pan=(voice - 1) * 0.4)
            if bar % 4 == 3:
                clang = note(1.4, degree(int(rng.integers(7, 12)), octave=1), 'triangle',
                             attack=0.002, decay=0.5, sustain=0.1, release=0.8,
                             hold=0.05, gain=0.14)
                place(canvas, at + beats * 3, clang, pan=-0.3)
        else:  # boss
            # Хорал из четырёх голосов, аккорд меняется каждые два такта.
            for voice, midi in enumerate(chord + [root]):
                length = beats * 4
                signal = note(length, midi + (12 if voice == 3 else 0), 'saw',
                              detune=(voice - 1.5) * 0.004, attack=0.25, decay=0.4,
                              sustain=0.75, release=0.9, hold=length - 1.6, gain=0.12)
                place(canvas, at, signal, pan=(voice - 1.5) * 0.3)
            # Удары молота по долям.
            for beat in (0, 2):
                hit_noise = noise(int(0.3 * RATE), seed + bar * 13 + beat)
                hit_noise = lowpass(hit_noise, 1400) * envelope(
                    len(hit_noise), 0.002, 0.1, 0.1, 0.15, 0.01)
                place(canvas, at + beat * beats, hit_noise * 0.4)
                tone = note(0.5, root - 24, 'sine', attack=0.002, decay=0.2,
                            sustain=0.1, release=0.25, hold=0.02, gain=0.5)
                place(canvas, at + beat * beats, tone)
            # Нарастающий пассаж во второй половине трека.
            if bar > bars // 2 and bar % 2 == 0:
                for step_index in range(6):
                    midi = degree(step_index + bar % 5, octave=1)
                    arp = note(0.3, midi, 'square', attack=0.004, decay=0.1,
                               sustain=0.3, release=0.2, hold=0.02, gain=0.08)
                    place(canvas, at + step_index * beats / 1.5, arp,
                          pan=float(np.sin(step_index)) * 0.5)

    # Сведение: реверб, мягкое ограничение и затухание в конце.
    left = reverb(canvas[0], amount=0.22, seed=seed + 101)
    right = reverb(canvas[1], amount=0.22, seed=seed + 202)
    stereo = np.stack([left, right])
    peak = np.max(np.abs(stereo)) + 1e-9
    stereo = np.tanh(stereo / peak * 1.1) * 0.85
    fade = int(2.5 * RATE)
    stereo[:, -fade:] *= np.linspace(1, 0, fade) ** 1.6
    stereo[:, : int(0.05 * RATE)] *= np.linspace(0, 1, int(0.05 * RATE))
    return np.ascontiguousarray(stereo.T)


def write_ogg(path, audio, block=65536):
    """Пишет OGG блоками: libsndfile падает на большом буфере целиком."""
    with sf.SoundFile(path, 'w', samplerate=RATE, channels=audio.shape[1],
                      format='OGG', subtype='VORBIS') as handle:
        for start in range(0, len(audio), block):
            handle.write(audio[start:start + block])


def main():
    os.makedirs(TARGET, exist_ok=True)
    with open(MANIFEST, encoding='utf-8') as handle:
        manifest = json.load(handle)
    known = {entry['file'] for entry in manifest['music']}
    plan = []
    for role in ('explore', 'fight', 'boss'):
        for index in range(8):
            name = f'{role}-{20 + index:02d}.ogg'
            if name not in known:
                plan.append((role, name, index))
    if not plan:
        print('новая музыка не нужна — все треки уже есть')
        return 0
    total_bytes = 0
    for role, name, index in plan:
        seed = {'explore': 11, 'fight': 29, 'boss': 47}[role] + index * 7
        audio = compose(role, seed, minutes=2.0)
        path = os.path.join(TARGET, name)
        write_ogg(path, audio)
        size = os.path.getsize(path)
        total_bytes += size
        title = {
            'explore': ['Тихий подвал', 'Пустой коридор', 'Капает вода', 'Холодный цех',
                        'Тени у стены', 'Скрип двери', 'Мокрый бетон', 'Ожидание'],
            'fight': ['Погоня', 'Стальная схватка', 'На звук', 'Драка в темноте',
                      'Отблеск выстрела', 'Узкий проход', 'Не отступать', 'Железо и кровь'],
            'boss': ['Он проснулся', 'Тяжёлые шаги', 'Молот и хорал', 'Последний рубеж',
                     'Дыхание туннеля', 'Лязг затвора', 'Счёт на удары', 'Финальный зал'],
        }[role][index]
        manifest['music'].append({
            'file': name,
            'role': role,
            'title': title,
            'license': 'CC0 1.0 (процедурная генерация)',
            'source': 'Синтезировано скриптом scripts/compose-music.py для «Заброшки»',
        })
        print(f'{name}: {size / 1e6:.1f} МБ')
    manifest['music'].sort(key=lambda entry: (entry['role'], entry['file']))
    manifest['note'] = (f'{len(manifest["sfx"])} звуков CC0 и {len(manifest["music"])} '
                        'музыкальных треков CC0.')
    with open(MANIFEST, 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=1)
    print(f'добавлено треков: {len(plan)}, {total_bytes / 1e6:.1f} МБ')
    print(f'всего музыки в манифесте: {len(manifest["music"])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
