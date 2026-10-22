import {cpSync,copyFileSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
// GitHub Pages is configured to serve main:/ without a build step.
// Keep a deployable snapshot at the repository root; source lives in src/.
rmSync('assets',{recursive:true,force:true});
mkdirSync('assets',{recursive:true});
cpSync('dist/assets','assets',{recursive:true});
copyFileSync('dist/index.html','index.html');
cpSync('dist/icons','icons',{recursive:true});
for(const file of ['manifest.webmanifest','sw.js','offline-build.json'])copyFileSync(`dist/${file}`,file);
writeFileSync('.nojekyll','');
