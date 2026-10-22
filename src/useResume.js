import {captureRun,mayWriteRun} from './runKeys';
import {useEffect,useRef,useState} from 'react';
export const pages=['home','journey','guides','classes','bosses','lore','treasures','tips','hub','tools','favorites','focus','runs','crafting','world'];
export const tools=['next','ready','atlas','bestiary','farm','compare','npc','alchemy','calendar','building','hall','quests','secrets','settings'];
export const resumeValid=v=>!!(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>['page','hubTab','scroll'].includes(k))&&pages.includes(v.page)&&tools.includes(v.hubTab)&&Number.isInteger(v.scroll)&&v.scroll>=0&&v.scroll<=1000000);
export function useResume(page,hubTab){
 const runId=useRef(captureRun());
 const [last,setLast]=useState(()=>{try{const v=JSON.parse(localStorage.getItem('terraria-resume'));return resumeValid(v)?v:null}catch{return null}}),restore=useRef(null);
 useEffect(()=>{if(page==='home'){try{const saved=JSON.parse(localStorage.getItem('terraria-resume'));if(resumeValid(saved))setLast(v=>JSON.stringify(v)===JSON.stringify(saved)?v:saved)}catch{}return}let timer;const save=()=>{if(restore.current!==null||!mayWriteRun(runId.current))return;const v={page,hubTab,scroll:Math.min(1000000,Math.round(scrollY))};try{localStorage.setItem('terraria-resume',JSON.stringify(v))}catch{}};const scroll=()=>{clearTimeout(timer);timer=setTimeout(save,300)};save();window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('pagehide',save);return()=>{clearTimeout(timer);window.removeEventListener('scroll',scroll);window.removeEventListener('pagehide',save)}},[page,hubTab]);
 useEffect(()=>{if(restore.current===null||page==='home')return;let frame,tries=0;const seek=()=>{const y=restore.current;if(y===null)return;if(document.documentElement.scrollHeight>=y+innerHeight||tries++>120){window.scrollTo({top:y,behavior:'instant'});restore.current=null}else frame=requestAnimationFrame(seek)};frame=requestAnimationFrame(seek);return()=>cancelAnimationFrame(frame)},[page,hubTab]);
 return {last,restore};
}
