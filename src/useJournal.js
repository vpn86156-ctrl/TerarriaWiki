import {captureRun,mayWriteRun} from './runKeys';
import {useState,useEffect} from 'react';
export function useJournal(key,initial){const [runId]=useState(()=>captureRun());const [value,setValue]=useState(()=>{try{return JSON.parse(localStorage.getItem(key))??initial}catch{return initial}});useEffect(()=>{try{if(!key.startsWith('terraria-motion')&&!['terraria-effects','terraria-quick'].includes(key)&&!mayWriteRun(runId))return;localStorage.setItem(key,JSON.stringify(value))}catch{}},[key,value]);return [value,setValue]}
