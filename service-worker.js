/* Scanner-only offline assets. Documents and authenticated APIs are never cached. */
const PREFIX='scanner-static:'+self.registration.scope;
const CACHE=PREFIX+':20261013-10';
const FILES=['index.php','style.css','script.js','scanner-core.js','scanner-reliability.js','manifest.json','icon-192x192.png','icon-512x512.png','shutter.mp3','vendor/eng.traineddata.gz','vendor/html5-qrcode.min.js','vendor/jspdf.umd.min.js','vendor/opencv.js','vendor/pdf.min.js','vendor/pdf.worker.min.js','vendor/por.traineddata.gz','vendor/sweetalert2.all.min.js','vendor/tesseract-core-lstm.wasm','vendor/tesseract-core-lstm.wasm.js','vendor/tesseract-core-simd-lstm.wasm','vendor/tesseract-core-simd-lstm.wasm.js','vendor/tesseract-core-simd.wasm','vendor/tesseract-core-simd.wasm.js','vendor/tesseract-core.wasm','vendor/tesseract-core.wasm.js','vendor/tesseract.min.js','vendor/worker.min.js','vendor/xlsx.full.min.js'];
const paths=new Set(FILES.map(p=>new URL(p,self.registration.scope).pathname));
const scopePath=new URL(self.registration.scope).pathname;
paths.add(scopePath);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);try{await cache.addAll(FILES.map(p=>new Request(new URL(p,self.registration.scope),{cache:'reload'})));}catch(e){await caches.delete(CACHE);throw e;}await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX+':')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url),scope=new URL(self.registration.scope);if(req.method!=='GET'||url.origin!==scope.origin||!paths.has(url.pathname)||req.headers.has('Authorization'))return;event.respondWith((async()=>{const key=new Request(url.pathname===scopePath?new URL('index.php',scope).href:url.origin+url.pathname);const cache=await caches.open(CACHE);try{const response=await fetch(req);if(response.ok&&response.type!=='opaque')await cache.put(key,response.clone());return response;}catch(error){const stored=await cache.match(key);if(stored)return stored;throw error;}})());});
async function askWindowToSync(){const windows=await self.clients.matchAll({type:'window'});for(const client of windows)client.postMessage({type:'SCANNER_SYNC_REQUIRED'});}
self.addEventListener('sync',event=>{if(event.tag==='sync-uploads'||event.tag==='docscan-sync')event.waitUntil(askWindowToSync());});
self.addEventListener('message',event=>{if(event.data?.type==='TRIGGER_SYNC')event.waitUntil(askWindowToSync());});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(self.registration.scope));});
