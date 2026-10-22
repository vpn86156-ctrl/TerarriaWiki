import React from 'react';
import {Pin,ArrowRight} from 'lucide-react';
import {bosses} from './data';
import {progression} from './progression';
export const focusValid=v=>v===null||!!(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>['type','id'].includes(k))&&((v.type==='boss'&&bosses.some(b=>b[0]===v.id))||(v.type==='stage'&&progression.some(s=>s.id===v.id))));
export function focusName(goal){if(!focusValid(goal)||!goal)return '';return goal.type==='boss'?bosses.find(b=>b[0]===goal.id)[1]:progression.find(s=>s.id===goal.id).name}
export function FocusDock({goal,onOpen,onClear}){const name=focusName(goal);return name?<aside className="focus-dock" aria-label="Закреплённая цель"><Pin size={17}/><button onClick={onOpen}><small>СЕЙЧАС В ПУТИ</small><strong>{name}</strong></button><button className="focus-open" onClick={onOpen}>Мой план<ArrowRight size={14}/></button><button className="focus-clear" aria-label="Открепить цель" onClick={onClear}>×</button></aside>:null}
