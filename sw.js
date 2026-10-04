const C='cymsar-v2',SHELL=['index.html','extra.js','extra2.js','web.js','parsers.js','merge.js','xlsxlite.js','exports.js','budgetxl.js','manifest.webmanifest'].map(f=>new URL(f,self.location).pathname);
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL.map(p=>p))).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(clients.claim())});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.origin===location.origin&&(u.pathname.startsWith('/api/data')||SHELL.includes(u.pathname))){e.respondWith(fetch(r).then(x=>{if(x.ok){const cp=x.clone();caches.open(C).then(c=>c.put(r,cp))}return x}).catch(()=>caches.match(r)))}});