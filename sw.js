const C="mrf-v3",F=["./","index.html","core.js","sync.js","app.js","manifest.webmanifest","icon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x))))));
self.addEventListener("fetch",e=>{if(e.request.method!="GET")return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c2=r.clone();caches.open(C).then(c=>c.put(e.request,c2))}return r}).catch(()=>caches.match(e.request)))});
