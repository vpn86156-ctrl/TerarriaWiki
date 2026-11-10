/* Семь редкостей. Порядок — от обычной к секретной. */
export const RARITIES = [
  { id:'common',    name:'Обычная',     css:'rar-common',    color:'#8A8D98', glow:'rgba(138,141,152,.5)' },
  { id:'rare',      name:'Редкая',      css:'rar-rare',      color:'#4FBF7A', glow:'rgba(79,191,122,.55)' },
  { id:'superb',    name:'Сверхредкая', css:'rar-superb',    color:'#4A8FE7', glow:'rgba(74,143,231,.55)' },
  { id:'epic',      name:'Эпическая',   css:'rar-epic',      color:'#9B59D0', glow:'rgba(155,89,208,.6)'  },
  { id:'mythic',    name:'Мифическая',  css:'rar-mythic',    color:'#D3455B', glow:'rgba(211,69,91,.6)'   },
  { id:'legendary', name:'Легендарная', css:'rar-legendary', color:'#E0B45C', glow:'rgba(224,180,92,.7)'  },
  { id:'secret',    name:'Секретная',   css:'rar-secret',    color:'#0A0B0F', glow:'rgba(162,118,216,.8)' }
];
export const RAR_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]));
export const RAR_INDEX = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));

/* Таблицы шансов по уровню добычи.
   tier 0 — первые боссы, tier 4 — вершина. Секретное не падает с мелких боссов. */
export const DROP_TABLES = [
  { common:70,  rare:22,  superb:7,  epic:1,    mythic:0,    legendary:0,    secret:0    },
  { common:52,  rare:28,  superb:13, epic:5.5,  mythic:1.2,  legendary:0.3,  secret:0    },
  { common:34,  rare:28,  superb:19, epic:12,   mythic:5,    legendary:1.8,  secret:0.2  },
  { common:20,  rare:24,  superb:22, epic:18,   mythic:10,   legendary:5,    secret:0.9  },
  { common:10,  rare:17,  superb:21, epic:23,   mythic:17,   legendary:10,   secret:2    },
  { common:4,   rare:10,  superb:16, epic:24,   mythic:24,   legendary:19,   secret:3    }
];
