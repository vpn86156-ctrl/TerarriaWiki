import React from 'react';
export const buildEras=['До хардмода','Мех. боссы','После Плантеры','Финал'];
export const armorSets={
 warrior:[['Molten_armor','Расплавленная броня'],['Adamantite_melee','Адамантитовая броня · шлем воина'],['Beetle_shell','Броня жука'],['Solar_Flare_armor','Солнечная броня']],
 ranger:[['Necro_armor','Некроброня'],['Titanium_ranged','Титановая броня · маска стрелка'],['Shroomite_bullet','Грибная броня'],['Vortex_armor','Броня вихря']],
 mage:[['Meteor_armor','Метеоритная броня'],['Adamantite_magic','Адамантитовая броня · головной убор мага'],['Spectre_mask','Спектральная броня · маска'],['Nebula_armor','Броня туманности']],
 summoner:[['Bee_armor','Пчелиная броня'],['Spider_armor','Паучья броня'],['Spooky_armor','Жуткая броня'],['Stardust_armor','Броня звёздной пыли']]
};
const commonEarly=['Gold_armor','Золотая броня · один из ранних вариантов'];
const routeSets={
 arrival:[['Wood_armor','Деревянная броня'],['Wood_armor','Деревянная броня'],['Wood_armor','Деревянная броня · до магической экипировки'],['Wood_armor','Деревянная броня · ранний вариант']],
 'first-boss':[commonEarly,commonEarly,['Gold_armor','Золотая броня · пока нет самоцветной мантии'],['Wood_armor','Деревянная броня · до специального комплекта']],
 evil:[commonEarly,commonEarly,armorSets.mage[0],['Bee_armor','Пчелиная броня · после необязательной Королевы пчёл']],
 dungeon:[armorSets.warrior[0],armorSets.ranger[0],['Jungle_armor','Броня джунглей'],armorSets.summoner[0]],
 underworld:[armorSets.warrior[0],armorSets.ranger[0],['Jungle_armor','Броня джунглей'],armorSets.summoner[0]],
 'early-hardmode':[armorSets.warrior[1],armorSets.ranger[1],armorSets.mage[1],armorSets.summoner[1]],
 mechanical:[['Hallowed_melee','Святая броня · воин'],['Hallowed_ranged','Святая броня · стрелок'],['Hallowed_magic','Святая броня · маг'],['Hallowed_summon','Святая броня · призыватель']],
 plantera:[['Turtle_armor','Черепашья броня'],['Hallowed_ranged','Святая броня · стрелок'],['Hallowed_magic','Святая броня · маг'],['Hallowed_summon','Святая броня · призыватель']],
 temple:[['Turtle_armor','Черепашья броня · до Голема'],armorSets.ranger[2],armorSets.mage[2],armorSets.summoner[2]],
 lunar:[armorSets.warrior[2],armorSets.ranger[2],armorSets.mage[2],armorSets.summoner[2]],
 endgame:[armorSets.warrior[3],armorSets.ranger[3],armorSets.mage[3],armorSets.summoner[3]]
};
export function getArmor(classId,stage){return armorSets[classId]?.[stage]||armorSets.warrior[0]}
export function routeArmor(classId,stageId){return (routeSets[stageId]||routeSets.arrival)[['warrior','ranger','mage','summoner'].indexOf(classId)]||routeSets.arrival[0]}
export function ArmorImage({classId,stage,routeStage,caption=false}){const [sprite,name]=routeStage?routeArmor(classId,routeStage):getArmor(classId,stage);return <figure className="armor-figure" data-armor={sprite} key={sprite}><div className="armor-plinth"><span className="armor-sigil"/><img src={`${import.meta.env.BASE_URL}assets/${sprite}.webp`} alt={name} className="sprite armor-sprite"/><span className="armor-ground"/></div>{caption&&<figcaption>{name}<small>Оригинальный игровой спрайт</small></figcaption>}</figure>}
export function ArmorStagePicker({value,onChange}){return <div className="armor-stage-picker" aria-label="Этап брони"><span>ПОКАЖИ БРОНЮ ЭТАПА</span><div>{buildEras.map((name,i)=><button key={name} aria-pressed={value===i} className={value===i?'selected':''} onClick={()=>onChange(i)}>{name}</button>)}</div></div>}
