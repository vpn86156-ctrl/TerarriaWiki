import { biomes, enemies } from "./expeditionData.js";
// A composed reference world, not a .wld reader. Rectangles define camera framing.
export const atlasRegions = [
  { id: "sky", box: [350, 35, 500, 155], zoom: 2.25 },
  { id: "forest", box: [265, 175, 250, 200], zoom: 3.1 },
  { id: "snow", box: [75, 185, 190, 240], zoom: 2.9 },
  { id: "desert", box: [515, 200, 170, 245], zoom: 2.8 },
  { id: "corruption", box: [680, 190, 130, 240], zoom: 2.8 },
  { id: "jungle", box: [810, 185, 210, 420], zoom: 2.6, focus: [915, 380] },
  { id: "crimson", box: [1020, 195, 115, 265], zoom: 2.7 },
  { id: "ocean", box: [0, 220, 80, 200], zoom: 3 },
  { id: "cavern", box: [290, 380, 425, 230], zoom: 2.2 },
  { id: "dungeon", box: [140, 340, 125, 255], zoom: 3.1 },
  { id: "hallow", box: [440, 340, 155, 175], zoom: 3 },
  { id: "mushroom", box: [570, 540, 215, 90], zoom: 3 },
  { id: "hell", box: [0, 665, 1200, 135], zoom: 2.6, focus: [610, 720] },
].map((r) => ({
  ...biomes.find((b) => b.id === r.id),
  ...r,
  ...(r.id === "ocean"
    ? {
        name: "Океан",
        level: "Край мира",
        color: "#7cbfdb",
        sprite: "Wood_Fishing_Pole",
        text: "Берег, океанские сундуки, рыбалка и место сражения с Герцогом Рыброном.",
        danger:
          "Под водой заканчивается воздух. Призыв Рыброна требует трюфельного червя; не используй его случайно как обычную наживку.",
        find: ["Water_Walking_Boots"],
        enemies: [],
        boss: "Duke_Fishron",
      }
    : {}),
}));
const r = (sprite, name, where, phase = 0) => ({ sprite, name, where, phase });
export const atlasResources = {
  forest: [
    r("Wood", "Древесина", "Деревья поверхности; основа первой базы."),
    r("Daybloom", "Дневноцвет", "Лесная трава. Семена собирай в цветение."),
    r("Mushroom", "Грибы", "Еда и ингредиенты зелий."),
    r(
      "Fallen_Star",
      "Упавшие звёзды",
      "На поверхности ночью; собери до рассвета.",
    ),
  ],
  sky: [
    r("Cloud", "Облака", "Блоки парящих островов."),
    r("Sunplate_Block", "Солнечные блоки", "В строениях небесных островов."),
    r("Soul_of_Flight", "Души полёта", "Добыча с виверн, не залежи руды.", 1),
  ],
  desert: [
    r("Cactus", "Кактус", "Растёт на песке поверхности."),
    r(
      "Desert_Fossil",
      "Пустынная окаменелость",
      "Подземная пустыня; обработка в экстрактинаторе.",
    ),
    r(
      "Sturdy_Fossil",
      "Прочная окаменелость",
      "Результат обработки; не самостоятельная жила в песке.",
    ),
    r(
      "Dark_Shard",
      "Тёмный осколок",
      "С тёмных мумий в заражённой пустыне.",
      1,
    ),
  ],
  snow: [
    r("Ice_Block", "Лёд", "Подземные снежные пещеры."),
    r("Snow_Block", "Снег", "Снежный слой поверхности."),
    r("Shiverthorn", "Морозная колючка", "Трава снежного биома."),
    r("Frost_Core", "Морозное ядро", "С ледяного голема во время метели.", 1),
  ],
  jungle: [
    r("Rich_Mahogany", "Красная древесина", "Деревья джунглей."),
    r(
      "Jungle_Spores",
      "Споры джунглей",
      "Светящиеся растения подземных джунглей.",
    ),
    r("Stinger", "Жало", "Добыча с подходящих врагов."),
    r(
      "Chlorophyte_Ore",
      "Хлорофитовая руда",
      "Растёт в грязи хардмода. Нужно 200% мощности кирки; обычный путь к ней — победа над тремя механическими боссами.",
      1,
    ),
    r(
      "Life_Fruit",
      "Плод жизни",
      "Подземные джунгли после хотя бы одного механического босса.",
      1,
    ),
  ],
  corruption: [
    r(
      "Demonite_Ore",
      "Демонитовая руда",
      "Небольшие залежи; также добыча с боссов.",
    ),
    r("Rotten_Chunk", "Гнилой кусок", "Материал с местных врагов."),
    r("Shadow_Scale", "Теневая чешуя", "С Пожирателя миров, не руда."),
    r(
      "Cursed_Flame",
      "Проклятое пламя",
      "Материал врагов подземного Искажения.",
      1,
    ),
  ],
  crimson: [
    r(
      "Crimtane_Ore",
      "Кримтановая руда",
      "Небольшие залежи; также добыча с боссов.",
    ),
    r("Vertebra", "Позвонок", "Материал местных противников."),
    r("Tissue_Sample", "Образец ткани", "С ползунцов и Мозга Ктулху."),
    r("Ichor", "Ихор", "С ихорных противников подземного Багрянца.", 1),
  ],
  cavern: [
    r(
      "Copper_Ore",
      "Медь / олово",
      "Альтернативная пара руд: обычно один вариант в мире.",
    ),
    r(
      "Iron_Ore",
      "Железо / свинец",
      "Руда для станков, инструментов и множества рецептов.",
    ),
    r(
      "Silver_Ore",
      "Серебро / вольфрам",
      "Обычно один вариант пары в естественной генерации.",
    ),
    r("Gold_Ore", "Золото / платина", "Глубокие залежи и отдельные рецепты."),
    r("Amethyst", "Самоцветы", "Разные самоцветы встречаются в камне."),
    r(
      "Cobalt_Ore",
      "Кобальт / палладий",
      "После подходящих алтарей хардмода; также из хардмодных ящиков.",
      1,
    ),
    r(
      "Mythril_Ore",
      "Мифрил / орихалк",
      "Следующий уровень руды после кобальта / палладия.",
      1,
    ),
    r(
      "Adamantite_Ore",
      "Адамантит / титан",
      "Глубокие слои; финальная пара алтарных руд.",
      1,
    ),
  ],
  hallow: [
    r(
      "Crystal_Shard",
      "Кристальные осколки",
      "Растут на перламутровом камне в слое пещер.",
      1,
    ),
    r(
      "Soul_of_Light",
      "Души света",
      "С подходящих врагов в пещерах Освящения.",
      1,
    ),
    r("Pixie_Dust", "Пыльца пикси", "С пикси на поверхности.", 1),
    r("Unicorn_Horn", "Рог единорога", "С единорогов поверхности.", 1),
  ],
  mushroom: [
    r("Glowing_Mushroom", "Светящийся гриб", "Грибная трава на грязи."),
    r(
      "Mushroom_Grass_Seeds",
      "Семена грибной травы",
      "Для своего грибного биома.",
    ),
    r(
      "Truffle_Worm",
      "Трюфельный червь",
      "Лови сачком в подземном грибном биоме хардмода.",
      1,
    ),
  ],
  dungeon: [
    r("Bone", "Кости", "Обычная добыча врагов темницы."),
    r(
      "Golden_Key",
      "Золотой ключ",
      "С врагов и из ёмкостей; расходуется на запертый золотой сундук.",
    ),
    r("Ectoplasm", "Эктоплазма", "С духов темницы после Плантеры.", 2),
  ],
  hell: [
    r(
      "Hellstone",
      "Адский камень",
      "Опасные горячие залежи; при добыче выделяют лаву.",
    ),
    r("Obsidian", "Обсидиан", "Образуется при контакте воды и лавы."),
    r("Ash_Block", "Пепел", "Основной строительный слой Ада."),
    r("Living_Fire_Block", "Живой огонь", "Добыча с врагов Ада в хардмоде.", 1),
  ],
  ocean: [
    r("Coral", "Коралл", "На дне океана."),
    r("Seashell", "Ракушки", "Декор на берегу."),
    r("Shark_Fin", "Акулий плавник", "С акул; ингредиент зелий."),
  ],
};
const mob = (id, name, where, phase = 0) => ({ id, name, where, phase });
export const atlasCreatures = {
  forest: [
    ...enemies.filter((e) => ["Green_Slime", "Pinky"].includes(e.id)),
    mob("Zombie", "Зомби", "Поверхность ночью."),
    mob("Demon_Eye", "Демонический глаз", "Поверхность ночью."),
  ],
  sky: [
    mob("Harpy", "Гарпия", "Высокое небо."),
    ...enemies.filter((e) => e.id === "Wyvern"),
  ],
  desert: [
    mob("Antlion", "Муравьиный лев", "Пустыня; стреляет песком."),
    mob("Antlion_Charger", "Муравьиный лев-воин", "Подземная пустыня."),
  ],
  snow: [
    mob("Ice_Slime", "Ледяной слизень", "Снежная поверхность."),
    mob("Ice_Bat", "Ледяная летучая мышь", "Ледяные пещеры."),
    ...enemies.filter((e) => e.id === "Ice_Tortoise"),
  ],
  jungle: [
    ...enemies.filter((e) => ["Hornet", "Angry_Trapper"].includes(e.id)),
    mob("Piranha", "Пиранья", "Вода джунглей и других подходящих мест."),
  ],
  corruption: [
    mob("Eater_of_Souls", "Пожиратель душ", "Поверхность Искажения."),
    mob("Corruptor", "Корраптор", "Искажение хардмода.", 1),
  ],
  crimson: [
    mob("Crimera", "Кримера", "Багрянец."),
    mob("Face_Monster", "Лицевой монстр", "Поверхность Багрянца."),
    mob("Herpling", "Прыгун", "Багрянец хардмода.", 1),
  ],
  cavern: [
    ...enemies.filter((e) => e.id === "Nymph"),
    mob("Cave_Bat", "Пещерная летучая мышь", "Обычные пещеры."),
    mob("Skeleton", "Скелет", "Подземные области."),
  ],
  hallow: enemies.filter((e) => e.biome === "hallow"),
  mushroom: [
    mob("Spore_Zombie", "Споровый зомби", "Грибной биом."),
    mob(
      "Giant_Fungi_Bulb",
      "Гигантский грибной нарост",
      "Грибные пещеры хардмода.",
      1,
    ),
  ],
  dungeon: enemies.filter((e) => e.biome === "dungeon"),
  hell: [
    ...enemies.filter((e) => e.id === "Fire_Imp"),
    mob("Hellbat", "Адская летучая мышь", "Пространство над лавой."),
    mob("Lava_Slime", "Лавовый слизень", "Ад; оставляет лаву при гибели."),
  ],
  ocean: [
    mob("Shark", "Акула", "Вода океана."),
    mob("Crab", "Краб", "Берег и океан."),
  ],
};
export const atlasPhaseNames = ["До хардмода", "Хардмод", "После Плантеры"];
export const phaseVisible = (entry, phase) => entry.phase <= phase;
export function cameraFor(region) {
  if (!region) return { x: 0, y: 0, scale: 1 };
  const [x, y, w, h] = region.box,
    s = region.zoom,
    [cx, cy] = region.focus || [x + w / 2, y + h / 2];
  return { x: 600 - cx * s, y: 400 - cy * s, scale: s };
}
export const biomeWiki = {
  forest: "Forest",
  sky: "Floating_Island",
  desert: "Desert",
  snow: "Snow_biome",
  jungle: "Jungle",
  corruption: "The_Corruption",
  crimson: "The_Crimson",
  hallow: "The_Hallow",
  cavern: "Cavern",
  mushroom: "Glowing_Mushroom_biome",
  dungeon: "Dungeon",
  hell: "The_Underworld",
  ocean: "Ocean",
};
// In-world anchors for resource veins/vegetation, a creature and a chest.
export const atlasLandmarks = {
  sky: [
    [490, 148],
    [640, 65],
    [735, 200],
  ],
  forest: [
    [452, 217],
    [340, 265],
    [410, 330],
  ],
  snow: [
    [120, 395],
    [210, 420],
    [205, 300],
  ],
  desert: [
    [590, 405],
    [650, 330],
    [565, 280],
  ],
  corruption: [
    [735, 380],
    [760, 260],
    [745, 420],
  ],
  crimson: [
    [1050, 400],
    [1100, 280],
    [1080, 450],
  ],
  jungle: [
    [870, 470],
    [925, 365],
    [985, 515],
  ],
  ocean: [
    [20, 335],
    [55, 300],
    [40, 390],
  ],
  cavern: [
    [410, 455],
    [555, 500],
    [470, 570],
  ],
  hallow: [
    [485, 465],
    [555, 420],
    [525, 490],
  ],
  mushroom: [
    [605, 595],
    [680, 573],
    [750, 612],
  ],
  dungeon: [
    [185, 430],
    [225, 485],
    [195, 550],
  ],
  hell: [
    [555, 742],
    [655, 702],
    [720, 730],
  ],
};
