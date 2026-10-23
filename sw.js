'use strict';
const PREFIX='chordbook:'+self.registration.scope+':';
const VERSION='chordbook-public-v3';
const CACHE=PREFIX+VERSION;
const FILES=['./','./index.html','./style.css','./csv.js','./app.js','./lyrics.js','./google-config.js','./google-sheets.js','./seed.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./privacy.html','./template.csv'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new Request(file,{cache:"reload"})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||!url.href.startsWith(self.registration.scope))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request);if(cached)return cached;
    if(event.request.mode==='navigate')return cache.match('./index.html');
    return fetch(event.request);
  }));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_OFFLINE'&&event.ports[0])event.waitUntil(caches.open(CACHE).then(async cache=>{
    const entries=await Promise.all(FILES.map(file=>cache.match(file)));
    event.ports[0].postMessage({ready:entries.every(Boolean),version:VERSION});
  }));
});
