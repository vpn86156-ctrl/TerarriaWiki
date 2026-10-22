import {readdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function buildOffline(dir='dist'){
 const walk=(folder,prefix='')=>readdirSync(folder).flatMap(name=>{const path=`${folder}/${name}`,rel=`${prefix}${name}`;return statSync(path).isDirectory()?walk(path,`${rel}/`):[rel]});
 const files=['index.html','manifest.webmanifest',...walk(`${dir}/assets`,'assets/'),...walk(`${dir}/icons`,'icons/')].sort();
 const hash=createHash('sha256').update(readFileSync('scripts/offline-build.mjs'));for(const f of files)hash.update(f).update(readFileSync(`${dir}/${f}`));const version=hash.digest('hex').slice(0,16);
 const code=`// Generated immutable offline snapshot. Never accesses localStorage or clears user data.
const VERSION=${JSON.stringify(version)}, CACHE='terraria-guide-v1-'+VERSION;
const FILES=${JSON.stringify(files)};
const root=self.registration.scope;
const urls=FILES.map(f=>new URL(f,root).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{const cache=await caches.open(CACHE);await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})))}catch(error){await caches.delete(CACHE);throw error}
 // Do NOT skipWaiting: the old complete snapshot stays active until explicit consent.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Other open tabs may still need their old hashed lazy modules. Keep their snapshots.
 const windows=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(root));
 if(windows.length<=1)for(const name of await caches.keys())if(name.startsWith('terraria-guide-v1-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
 if(['STATUS','PREPARE'].includes(event.data?.type))event.waitUntil((async()=>{
  try{const cache=await caches.open(CACHE);if(event.data.type==='PREPARE')await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));const keys=new Set((await cache.keys()).map(r=>r.url));event.ports[0]?.postMessage({version:VERSION,ready:urls.every(url=>keys.has(url)),files:FILES.length})}catch{event.ports[0]?.postMessage({ready:false,error:true})}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(!url.href.startsWith(root))return;
 if(request.mode==='navigate'){
  if(url.pathname!==new URL(root).pathname&&url.pathname!==new URL('index.html',root).pathname)return;
  event.respondWith(caches.open(CACHE).then(c=>c.match(new URL('index.html',root).href)).then(r=>r||fetch(request)));return;
 }
 if(!urls.includes(url.href)){
  if(url.pathname.startsWith(new URL('assets/',root).pathname))event.respondWith((async()=>{for(const name of (await caches.keys()).reverse())if(name.startsWith('terraria-guide-v1-')){const hit=await(await caches.open(name)).match(request);if(hit)return hit}return fetch(request)})());
  return;
 }
 event.respondWith(caches.open(CACHE).then(c=>c.match(request)).then(r=>r||fetch(request)));
});\n`;
 writeFileSync(`${dir}/sw.js`,code);writeFileSync(`${dir}/offline-build.json`,JSON.stringify({version,files:files.length,bytes:files.reduce((n,f)=>n+statSync(`${dir}/${f}`).size,0)}));
 return {version,files:files.length};
}
