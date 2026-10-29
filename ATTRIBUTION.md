# Откуда звуки, музыка и шрифты

## Звуки (CC0 1.0)

Всего сэмплов: **121** файлов в `public/audio/sfx/`.
Источник: сборник [open-game-sfx-index](https://github.com/Legerdo/open-game-sfx-index) (CC0),
внутри него — паки:

- `impact-sounds` — 21 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-rpg-80` — 18 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-creatures-80` — 16 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-foley-100-v2` — 12 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-creatures-80-v2` — 9 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-footsteps` — 8 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `sci-fi-sounds` — 6 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `interface-sounds` — 6 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `ui-audio` — 6 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-scifi-50` — 5 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-100-foley` — 5 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `rpg-audio` — 2 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-metal-wood-100` — 2 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-loops-30` — 2 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `voiceover-pack` — 2 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-breaking-75` — 1 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)

Группы звуков в игре: ambient, boom, click, door, growl, gun, hit, hurt, pickup, reload, step, swing.

## Музыка (CC0 1.0)

Всего треков: **16** в `public/audio/music/`. Источник:
[FreePD](https://freepd.com) через сборник
[SoundSafari/CC0-1.0-Music](https://github.com/SoundSafari/CC0-1.0-Music) (CC0 1.0).

| Файл | Роль | Трек |
| --- | --- | --- |
| `explore-01.mp3` | исследование | Dark Hallway |
| `explore-02.mp3` | исследование | Deep Tones |
| `explore-03.mp3` | исследование | Horror Suspense |
| `explore-04.mp3` | исследование | Attic Secrets |
| `explore-05.mp3` | исследование | Mysterious Lights |
| `explore-06.mp3` | исследование | Footsteps in the Attic |
| `explore-07.mp3` | исследование | Painful Disorientation |
| `explore-08.mp3` | исследование | Ancient Rite |
| `fight-01.mp3` | бой | Night Attack |
| `fight-02.mp3` | бой | Battle Ready |
| `fight-03.mp3` | бой | Beginning of Conflict |
| `fight-04.mp3` | бой | Find Them |
| `fight-05.mp3` | бой | Satin Danger |
| `fight-06.mp3` | бой | Hit n Smash |
| `boss-01.mp3` | босс | Epic Boss Battle |
| `boss-02.mp3` | босс | The Enemy |

## Шрифты (SIL Open Font License 1.1)

- **Manrope** — текст интерфейса.
- **Russo One** — заголовки.

Лицензии: `public/licenses/Manrope-OFL.txt`, `public/licenses/Russo-One-OFL.txt`.

## Графика

Вся внутриигровая графика рисуется процедурно в `src/render.js` — пиксельные тайлы
и спрайты собираются из палитр локаций. Иконка приложения создана нейросетью и
переведена в пиксельный вид: `public/images/app-icon-192.png` (и 512 для стора).

## Код

Игра собрана на Vite и упакована в APK с помощью aapt2, javac, D8 и apksigner.
Инструменты разработки лежат в devDependencies и лицензируются их собственными
лицензиями (MIT/Apache), но в сам APK не попадают.
