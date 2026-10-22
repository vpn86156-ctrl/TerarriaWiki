// Common community names and the wording already used elsewhere in this guide.
// The primary name remains the original game's Russian localization.
import {treasures} from './treasures';
const key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const extra={
 'Terra Blade':'Терра-меч Терра меч Терраблейд',
 "Night's Edge":'Грань ночи',
 "True Night's Edge":'Истинная Грань ночи',
 'True Excalibur':'Истинный Экскалибур',
 'Hallowed Bar':'Святой слиток святые слитки',
 'Soul of Light':'Душа света души света',
 'Soul of Night':'Душа ночи души ночи',
 'Soul of Flight':'Душа полета души полета',
 'Soul of Might':'Душа могущества души могущества',
 'Soul of Sight':'Душа зрения души зрения',
 'Soul of Fright':'Душа страха души страха',
 'Bottled Water':'Бутылка воды бутылка с водой',
 'Daybloom':'Дневноцвет',
 'Deathweed':'Смертотрава смерть-трава',
 'Waterleaf':'Воднолист водолист',
 'Shiverthorn':'Морозная колючка дрожецвет',
 'Armored Cavefish':'Бронированная пещерная рыба',
 'Variegated Lardfish':'Пестрая жирнорыба',
 'Tinkerers Workshop':'Мастерская изобретателя мастерская гоблина',
 'Nebula Fragment':'Фрагмент туманности',
 'Vortex Fragment':'Фрагмент вихря',
 'Stardust Fragment':'Фрагмент звездной пыли',
 'Solar Fragment':'Солнечный фрагмент',
};
const aliases=Object.fromEntries(Object.entries(extra).map(([name,text])=>[key(name),text]));
for(const t of treasures)aliases[key(t.id)]=[aliases[key(t.id)]||'',t.name].join(' ');
export const itemAliases=item=>aliases[key(item.en)]||'';
