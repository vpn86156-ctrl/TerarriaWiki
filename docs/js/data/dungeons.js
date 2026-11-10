/* Подземелья: порог входа, враги, босс и собственные награды. */
export const DUNGEONS = [
  {
    id:'crypt', name:'Забытый склеп', img:'img/bosses/stone-giant.jpg',
    reqLevel:3, difficulty:1, boss:'stone',
    desc:'Каменные плиты помнят имена, которые никто не произносит вслух.',
    enemies:['Скелет-копейщик','Гниющий страж','Псарь склепа'],
    reward:{ gold:420, xp:300, tier:1 },
    unique:'Плита забытых имён'
  },
  {
    id:'abyss', name:'Бездна демонов', img:'img/bosses/demon.jpg',
    reqLevel:9, difficulty:2, boss:'demon',
    desc:'Жар поднимается снизу, и он не от огня — он от дыхания тех, кто ждёт.',
    enemies:['Пепельный бес','Цепной мучитель','Крылатый зовущий'],
    reward:{ gold:2100, xp:1450, tier:2 },
    unique:'Осколок цепи Варгота'
  },
  {
    id:'temple', name:'Храм древних', img:'img/bosses/lich-king.jpg',
    reqLevel:18, difficulty:3, boss:'lich',
    desc:'Стены сложены из клятв. Каждая вторая уже нарушена.',
    enemies:['Рунический жрец','Хранитель клятвы','Бестелесный певчий'],
    reward:{ gold:9600, xp:6400, tier:3 },
    unique:'Корона непроизнесённого имени'
  },
  {
    id:'forest', name:'Проклятый лес', img:'img/bosses/dragon.jpg',
    reqLevel:30, difficulty:4, boss:'dragon',
    desc:'Деревья растут костями вверх. Если идти достаточно тихо, можно пройти незамеченным. Почти.',
    enemies:['Древесный упырь','Туманный ловчий','Корневая тварь'],
    reward:{ gold:42000, xp:28000, tier:4 },
    unique:'Сердцевина мёртвого дуба'
  },
  {
    id:'rift', name:'Космический разлом', img:'img/bosses/cosmic.jpg',
    reqLevel:45, difficulty:5, boss:'cosmic',
    desc:'Здесь небо сложено в складки. Смотреть в них можно, но недолго.',
    enemies:['Осколок разлома','Бездонный наблюдатель','Складка пространства'],
    reward:{ gold:185000, xp:120000, tier:5 },
    unique:'Фрагмент несуществующей звезды'
  }
];
export function dungeonById(id){ return DUNGEONS.find(d => d.id === id) || null; }
