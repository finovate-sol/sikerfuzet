// Sikerfüzet / Szem service worker
// - Oldalak (HTML): hálózat először, rövid várakozással; ha nincs net vagy túl lassú, a legutóbbi mentett változat.
//   Így a frissítés ugyanúgy azonnal megjön (az index.html build-ellenőrzése is működik), de térerő nélkül is megnyílik.
// - Statikus fájlok (js, képek, ikonok, betűk, CDN-könyvtárak): gyorsítótárból azonnal, háttérben frissítve.
// - Firebase / Google API hívásokat nem érinti.
const VER = 'sf-v1';
const STATIKUS = /\.(?:js|css|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|json)$/i;
const CDN = /^https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\//;

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        for(const k of await caches.keys()) if(k !== VER) await caches.delete(k);
        await self.clients.claim();
    })());
});

const tarol = async (req, res) => { if(res && (res.ok || res.type === 'opaque')){ const c = await caches.open(VER); await c.put(req, res.clone()); } return res; };

self.addEventListener('fetch', e => {
    const req = e.request;
    if(req.method !== 'GET') return;
    const url = new URL(req.url);
    const sajat = url.origin === self.location.origin;
    // a build-ellenőrzés (?nc=…) és a kifejezetten gyorsítótár nélküli kérések mindig a hálózatra mennek
    if(sajat && url.searchParams.has('nc')) return;
    if(req.cache === 'no-store' || req.cache === 'reload') return;

    if(req.mode === 'navigate' && sajat){
        e.respondWith((async () => {
            const kulcs = new Request(url.origin + url.pathname);
            const halo = fetch(req).then(r => tarol(kulcs, r));
            const varakozas = new Promise(ok => setTimeout(ok, 3500));
            try {
                const r = await Promise.race([halo, varakozas.then(() => null)]);
                if(r) return r;
                const c = await caches.match(kulcs); if(c) return c;
                return await halo;
            } catch(err){
                const c = await caches.match(kulcs); if(c) return c;
                throw err;
            }
        })());
        return;
    }

    if((sajat && STATIKUS.test(url.pathname) && !url.pathname.endsWith('/sw.js')) || CDN.test(req.url)){
        e.respondWith((async () => {
            const c = await caches.match(req);
            const friss = fetch(req).then(r => tarol(req, r)).catch(() => null);
            if(c){ e.waitUntil(friss); return c; }
            const r = await friss; if(r) return r;
            return fetch(req);
        })());
    }
});
