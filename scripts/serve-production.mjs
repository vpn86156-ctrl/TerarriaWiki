// Local test server for the exact GitHub Pages mount, not part of the app.
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),base='/TerarriaWiki/',types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2'};
createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(base)){res.writeHead(404);res.end();return}const rel=decodeURIComponent(url.pathname.slice(base.length))||'index.html',file=resolve(root,rel);if(!file.startsWith(root+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file))}catch{res.writeHead(400);res.end()}}).listen(8111,'0.0.0.0',()=>console.log('Production snapshot: http://0.0.0.0:8111/TerarriaWiki/'));
