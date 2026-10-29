# Откуда звуки, музыка и шрифты

## Звуки (CC0 1.0)

Всего сэмплов: **685** файлов в `public/audio/sfx/`.
Источник: сборник [open-game-sfx-index](https://github.com/Legerdo/open-game-sfx-index) (CC0),
внутри него — паки:

- `impact-sounds` — 151 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-rpg-80` — 74 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `ui-audio` — 50 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-foley-100-v2` — 46 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `sci-fi-sounds` — 39 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-creatures-80-v2` — 38 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `interface-sounds` — 38 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-creatures-80` — 37 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-100-foley` — 29 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-metal-wood-100` — 29 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `rpg-audio` — 27 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-scifi-50` — 26 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-breaking-75` — 26 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `digital-audio` — 21 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-loops-30` — 18 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `music-jingles` — 17 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-footsteps` — 9 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `oga-rubberduck-water-40` — 6 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `casino-audio` — 2 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)
- `voiceover-pack` — 2 звуков, CC0 1.0. open-game-sfx-index (github.com/Legerdo/open-game-sfx-index)

Сэмплы сведены в 12 групп (`swing`, `hit`, `gun`, `boom`, `step`, `door`,
`pickup`, `growl`, `hurt`, `click`, `reload`, `ambient`); движок играет
случайный файл из группы, поэтому звук не повторяется дословно.

## Музыка (CC0 1.0)

Всего треков: **40** в `public/audio/music/`.

### Скачанные треки — 16 MP3

Источник: [FreePD](https://freepd.com) через сборник
[SoundSafari/CC0-1.0-Music](https://github.com/SoundSafari/CC0-1.0-Music) (CC0 1.0).

| Файл | Роль | Трек |
| --- | --- | --- |
| `boss-01.mp3` | босс | Epic Boss Battle |
| `boss-02.mp3` | босс | The Enemy |
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

### Собственная музыка — 24 OGG

Эти треки не скачаны ниоткуда: они синтезируются скриптом
`scripts/compose-music.py` (numpy + libsndfile) и поэтому тоже CC0.
Три роли — исследование, бой, босс — по восемь треков, каждый длиной две минуты.

| Файл | Роль | Трек |
| --- | --- | --- |
| `boss-20.ogg` | босс | Он проснулся |
| `boss-21.ogg` | босс | Тяжёлые шаги |
| `boss-22.ogg` | босс | Молот и хорал |
| `boss-23.ogg` | босс | Последний рубеж |
| `boss-24.ogg` | босс | Дыхание туннеля |
| `boss-25.ogg` | босс | Лязг затвора |
| `boss-26.ogg` | босс | Счёт на удары |
| `boss-27.ogg` | босс | Финальный зал |
| `explore-20.ogg` | исследование | Тихий подвал |
| `explore-21.ogg` | исследование | Пустой коридор |
| `explore-22.ogg` | исследование | Капает вода |
| `explore-23.ogg` | исследование | Холодный цех |
| `explore-24.ogg` | исследование | Тени у стены |
| `explore-25.ogg` | исследование | Скрип двери |
| `explore-26.ogg` | исследование | Мокрый бетон |
| `explore-27.ogg` | исследование | Ожидание |
| `fight-20.ogg` | бой | Погоня |
| `fight-21.ogg` | бой | Стальная схватка |
| `fight-22.ogg` | бой | На звук |
| `fight-23.ogg` | бой | Драка в темноте |
| `fight-24.ogg` | бой | Отблеск выстрела |
| `fight-25.ogg` | бой | Узкий проход |
| `fight-26.ogg` | бой | Не отступать |
| `fight-27.ogg` | бой | Железо и кровь |

## Шрифты (SIL Open Font License 1.1)

- **Manrope** — текст интерфейса.
- **Russo One** — заголовки.

Лицензии: `public/licenses/Manrope-OFL.txt`, `public/licenses/Russo-One-OFL.txt`.

## Графика

**Спрайты.** Тайлы локаций (пол, стены, двери, выходы), герой, враги, боссы, реквизит,
предметы и оружие нарисованы нейросетью по нашему описанию в пиксельном стиле 16 бит.
Исходники лежат в `art-source/` (каждый файл — один объект на маджентовом фоне),
а `scripts/cut-sprites.py` вырезает фон, приводит размер, ограничивает палитру до
48 цветов и раскладывает готовые PNG в `public/images/sprites/` вместе с `manifest.json`.
Игра грузит их при старте (`loadSprites` в `src/render.js`); если картинок нет —
рендер рисует процедурный резерв из палитр локаций, поэтому игра остаётся рабочей
и без ассетов.

**Фоны экранов.** Пять больших сцен в `public/images/scenes/` (титул, магазин, больничный
коридор, цех завода, «вы погибли») нарисованы нейросетью по нашему описанию и
подключаются как фон соответствующих экранов через `src/style.css` с затемнением,
чтобы текст оставался читаемым.

Процедурная графика (виньетка, свет, частицы, мини-карта) по-прежнему рисуется кодом
в `src/render.js`. Иконка приложения создана нейросетью и переведена в пиксельный вид:
`public/images/app-icon-192.png` (и 512 для стора).

## Код

Игра собрана на Vite и упакована в APK с помощью aapt2, javac, D8 и apksigner.
Инструменты разработки лежат в devDependencies и лицензируются их собственными
лицензиями (MIT/Apache), но в сам APK не попадают.
