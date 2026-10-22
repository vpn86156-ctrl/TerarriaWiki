// Copy missing, unmodified game sprites from the pinned terrabook archive.
// Usage: node scripts/import-atlas-assets.mjs /path/to/terrabook-<commit>
import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {atlasResources,atlasCreatures} from '../src/atlasData.js';
const source=process.argv[2]&&resolve(process.argv[2],'public/images');
if(!source||!existsSync(source))throw new Error('Укажи распакованный terrabook ревизии 0aa83be93a1881d15a98376643b4dbe331f16446.');
const dest=resolve('public/assets');
const ids=new Set(['Gold_Chest',...Object.values(atlasResources).flat().map(r=>r.sprite),...Object.values(atlasCreatures).flat().map(e=>e.id)]);
// Validate the complete input before writing anything; retain existing sprites.
for(const id of ids)if(!existsSync(join(dest,id+'.webp'))&&!existsSync(join(source,id+'.webp')))throw new Error(`Не найден оригинальный спрайт: ${id}`);
mkdirSync(dest,{recursive:true});let added=0;
for(const id of ids){const target=join(dest,id+'.webp');if(!existsSync(target)){copyFileSync(join(source,id+'.webp'),target);added++}}
console.log(`Атлас: ${ids.size} локальных спрайтов проверено, добавлено ${added}. Существующие файлы не изменены.`);
