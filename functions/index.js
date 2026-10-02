// ============================================================================
//  SIKERFÜZET – STRAVA-ÖSSZEKÖTÉS (Firebase Cloud Functions, 2. generáció)
//
//  Miért kell szerver? A Strava a belépési kódot csak a Client Secret-tel
//  együtt cseréli tokenre, és a secret nem kerülhet a GitHub Pages-en futó,
//  bárki által olvasható oldalba. Ezért ez a három függvény fut a Firebase-en:
//
//    stravaCsatol    – a Strava-visszairányításból kapott kódot tokenre cseréli
//    stravaSzinkron  – lehúzza a megadott napok aktivitásait
//    stravaReszletek – egy-egy aktivitás részletei (legjobb idők 1 km / 5 km / 10 km…)
//    stravaZonak     – pulzuszónák és km-enkénti tempó egy aktivitáshoz
//    stravaElso      – az első Strava-aktivitás napja (a teljes előzmény lehúzásához)
//    stravaLevalaszt – visszavonja a hozzáférést és törli a tokent
//
//  A szerver CSAK a tokent tárolja: strava_token/{uid} (access/refresh token).
//  A firestore.rules ezt a böngészőnek TILTJA; csak ez a szerver (Admin SDK) éri el.
//  Minden mást az app ment a saját edzésnaplójába:
//    edzes/{uid}_strava  – kié a fiók, mikor volt szinkron (a stravaCsatol válasza)
//    edzes/{uid}_sv{év}  – { napok: { "2026-09-28": [aktivitás, …] } } (a stravaSzinkron válasza)
//  Egy nap kulcsa akkor is ott van (üres listával), ha aznap nem volt
//  aktivitás – így tudja az app, hogy a nap le van szinkronizálva.
//  A párosítást (melyik tervezett edzést melyik aktivitás igazolja) az app
//  végzi a böngészőben, hogy a kézi jelölés mindig elsőbbséget kapjon.
//
//  TELEPÍTÉS (egyszer):
//    firebase functions:secrets:set STRAVA_CLIENT_SECRET
//    firebase deploy --only functions
// ============================================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// A Client ID nem titok – a böngésző is ezzel indítja a Strava-belépést.
const STRAVA_CLIENT_ID = '282966';
const STRAVA_CLIENT_SECRET = defineSecret('STRAVA_CLIENT_SECRET');
const OPTS = { region: 'europe-west1', secrets: [STRAVA_CLIENT_SECRET], maxInstances: 3, timeoutSeconds: 60 };
const NAP = /^\d{4}-\d{2}-\d{2}$/;

// Ugyanaz a kapu, mint a firestore.rules isUser()-e: belépett ÉS az
// allowlistán szereplő felhasználó. (A dokumentum-azonosító a kisbetűs email.)
async function engedelyezett(req){
    if(!req.auth) throw new HttpsError('unauthenticated', 'Jelentkezz be újra.');
    const email = String(req.auth.token.email || '').toLowerCase();
    if(!email) throw new HttpsError('permission-denied', 'A fiókodhoz nem tartozik email-cím.');
    const snap = await db.doc(`allowed_users/${email}`).get();
    if(!snap.exists) throw new HttpsError('permission-denied', 'Nincs hozzáférésed a Sikerfüzethez.');
    return req.auth.uid;
}

async function stravaToken(body){
    let res;
    try {
        res = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // trim: a titok beállításakor véletlenül bemásolt szóköz / sortörés ne rontsa el
            body: JSON.stringify({ client_id: STRAVA_CLIENT_ID, client_secret: String(STRAVA_CLIENT_SECRET.value() || '').trim(), ...body }),
        });
    } catch(e){ throw new HttpsError('unavailable', 'A Strava most nem érhető el – próbáld újra később.'); }
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
        // A Strava megmondja, melyik mező a hibás: {errors:[{resource, field, code}]}.
        // A naplóba (functions:log) is beírjuk – titok nélkül.
        const hibak = Array.isArray(data.errors) ? data.errors : [];
        console.error('Strava token-csere elutasítva', res.status, body.grant_type, JSON.stringify(hibak), data.message || '');
        const mezo = f => hibak.some(h => h.field === f);
        if(mezo('client_secret') || mezo('client_id'))
            throw new HttpsError('failed-precondition', 'A Strava szerint a Client Secret hibás. Állítsd be újra (firebase functions:secrets:set STRAVA_CLIENT_SECRET), pontosan úgy, ahogy a Strava API-oldalán látszik, majd telepítsd ki újra a függvényeket.');
        if(mezo('code'))
            throw new HttpsError('failed-precondition', 'A Strava-kód lejárt vagy már felhasználták – indítsd újra az összekötést a „Strava összekötése” gombbal.');
        if(mezo('refresh_token'))
            throw new HttpsError('failed-precondition', 'A Strava-hozzáférés lejárt vagy visszavonták – kösd össze újra a fiókodat.');
        if(res.status === 400 || res.status === 401)
            throw new HttpsError('failed-precondition', `A Strava elutasította a kérést (${res.status}${data.message ? ': ' + data.message : ''}) – kösd össze újra a fiókodat.`);
        throw new HttpsError('unavailable', `A Strava hibát jelzett (${res.status}).`);
    }
    return data;
}

// Érvényes access token; ha lejár (6 óránként), a refresh tokennel frissít.
async function hozzaferes(uid){
    const ref = db.doc(`strava_token/${uid}`);
    const snap = await ref.get();
    if(!snap.exists) throw new HttpsError('failed-precondition', 'A Strava nincs összekötve.');
    const t = snap.data();
    if(t.expires_at && t.expires_at > Date.now() / 1000 + 120) return t.access_token;
    const u = await stravaToken({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
    await ref.set({ access_token: u.access_token, refresh_token: u.refresh_token, expires_at: u.expires_at,
                    frissitve: FieldValue.serverTimestamp() }, { merge: true });
    return u.access_token;
}

exports.stravaCsatol = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const code = String((req.data && req.data.code) || '');
    const scope = String((req.data && req.data.scope) || '');
    if(!/^[A-Za-z0-9]{10,200}$/.test(code)) throw new HttpsError('invalid-argument', 'Hibás Strava-kód.');
    if(!scope.split(',').some(s => s === 'activity:read' || s === 'activity:read_all'))
        throw new HttpsError('failed-precondition', 'A Stravánál az edzéseid olvasását is engedélyezni kell (a „View data about your activities” pipa).');
    const t = await stravaToken({ code, grant_type: 'authorization_code' });
    const a = t.athlete || {};
    await db.doc(`strava_token/${uid}`).set({
        access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at,
        athleteId: a.id || null, scope, frissitve: FieldValue.serverTimestamp(),
    });
    return { athleteId: a.id || null, nev: [a.firstname, a.lastname].filter(Boolean).join(' ') || 'Strava-fiók',
             osszekotve: new Date().toISOString() };
});

// Egy aktivitás mindazzal, amit a Strava listája elárul róla. Rövid mezőnevek,
// és ami üres / nulla, az kimarad – egy év így is bőven elfér egy dokumentumban.
function aktivitas(a){
    const x = {
        id: String(a.id), n: String(a.name || '').slice(0, 80), tip: a.sport_type || a.type || '',
        perc: Math.round((a.moving_time || 0) / 60), km: Math.round((a.distance || 0) / 100) / 10,
        ido: String(a.start_date_local || '').slice(11, 16),          // kezdés, helyi idő (ÓÓ:PP)
        sec: a.moving_time || 0, esec: a.elapsed_time || 0,           // mozgásidő / teljes idő (mp)
        m: Math.round(a.distance || 0),                                // táv méterben (a tempóhoz)
        emel: Math.round(a.total_elevation_gain || 0),                 // szintemelkedés (m)
        magas: a.elev_high != null ? Math.round(a.elev_high) : 0,     // legmagasabb pont (m)
        seb: Math.round((a.average_speed || 0) * 100) / 100,           // átlagsebesség (m/s)
        mseb: Math.round((a.max_speed || 0) * 100) / 100,              // max sebesség (m/s)
        pulz: Math.round(a.average_heartrate || 0), mpulz: Math.round(a.max_heartrate || 0),
        kad: Math.round((a.average_cadence || 0) * 10) / 10,           // kadencia (futásnál lábanként)
        watt: Math.round(a.average_watts || 0), mwatt: Math.round(a.max_watts || 0),
        wattMert: !!a.device_watts,                                    // mért (és nem becsült) teljesítmény
        kj: Math.round(a.kilojoules || 0),
        szenv: Math.round(a.suffer_score || 0),                        // Relative Effort
        homers: a.average_temp != null ? Math.round(a.average_temp) : 0,
        kudos: a.kudos_count || 0, komm: a.comment_count || 0, foto: a.total_photo_count || 0,
        pr: a.pr_count || 0, eredm: a.achievement_count || 0,
        belteri: !!a.trainer, ingazas: !!a.commute, kezi: !!a.manual, privat: !!a.private,
        edzes: a.workout_type || 0,                                    // futás: 1 verseny, 2 hosszú, 3 edzés
    };
    return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== 0 && v !== false && v !== ''));
}

exports.stravaSzinkron = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const { tol, ig } = req.data || {};
    if(!NAP.test(String(tol)) || !NAP.test(String(ig)) || tol > ig) throw new HttpsError('invalid-argument', 'Hibás időszak.');
    const napok = {};
    for(const d = new Date(tol + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)){
        const s = d.toISOString().slice(0, 10);
        if(s > ig) break;
        napok[s] = [];
        if(Object.keys(napok).length > 400) throw new HttpsError('invalid-argument', 'Egyszerre legfeljebb 400 nap szinkronizálható.');
    }
    const token = await hozzaferes(uid);
    // A Strava UTC-ben szűr, a napot viszont a helyi kezdési idő (start_date_local)
    // adja – ezért mindkét irányban ráhagyunk egy napot, és utána szűrünk.
    const after = Date.parse(tol + 'T00:00:00Z') / 1000 - 86400;
    const before = Date.parse(ig + 'T00:00:00Z') / 1000 + 2 * 86400;
    let db_ = 0;
    for(let oldal = 1; oldal <= 15; oldal++){
        let r;
        try {
            r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=100&page=${oldal}`,
                            { headers: { Authorization: `Bearer ${token}` } });
        } catch(e){ throw new HttpsError('unavailable', 'A Strava most nem érhető el – próbáld újra később.'); }
        if(r.status === 401) throw new HttpsError('failed-precondition', 'A Strava-hozzáférés lejárt vagy visszavonták – kösd össze újra.');
        if(r.status === 429) throw new HttpsError('resource-exhausted', 'A Strava most túl sok kérést kapott – próbáld pár perc múlva.');
        if(!r.ok) throw new HttpsError('unavailable', `A Strava hibát jelzett (${r.status}).`);
        const lista = await r.json();
        for(const a of lista){
            const s = String(a.start_date_local || '').slice(0, 10);
            if(!napok[s]) continue;
            napok[s].push(aktivitas(a));
            db_++;
        }
        if(lista.length < 100) break;
    }
    return { napok, db: db_, utolsoSzinkron: new Date().toISOString() };
});

// A futások legjobb részidői (best_efforts) csak az aktivitás részletes
// lekérésében vannak benne – a Csúcsok fül ezekből dolgozik. Egy hívás
// legfeljebb 15 aktivitást kér le; ha a Strava kerete (100 kérés / 15 perc)
// közben elfogy, az addig lekértet adjuk vissza, limit jelzéssel.
// A Strava a neveket "1K", "5K", "10K", "1 mile", "Half-Marathon" alakban adja – kisbetűsítve hasonlítjuk.
const BE_KULCS = { '1k': 'k1', '1 mile': 'mi1', '5k': 'k5', '10k': 'k10', 'half-marathon': 'hm', 'marathon': 'm' };
function reszlet(a){
    const be = {};
    for(const x of a.best_efforts || []){
        const k = BE_KULCS[String(x.name || '').trim().toLowerCase()], t = Math.round(x.elapsed_time || 0);
        if(k && t > 0 && (!be[k] || t < be[k])) be[k] = t;
    }
    const x = {
        be: Object.keys(be).length ? be : null,                        // legjobb részidők (mp)
        kcal: Math.round(a.calories || 0),
        eszk: String(a.device_name || '').slice(0, 60),                // rögzítő eszköz (óra, telefon)
        desc: String(a.description || '').slice(0, 200),
    };
    return Object.fromEntries(Object.entries(x).filter(([, v]) => v));
}

exports.stravaReszletek = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const ids = (req.data && req.data.ids) || [];
    if(!Array.isArray(ids) || !ids.length || ids.length > 15 || !ids.every(x => /^\d{1,20}$/.test(String(x))))
        throw new HttpsError('invalid-argument', 'Egyszerre 1–15 aktivitás kérhető le.');
    const token = await hozzaferes(uid);
    const reszletek = {};
    let limit = false;
    for(const id of ids){
        let r;
        try { r = await fetch(`https://www.strava.com/api/v3/activities/${id}?include_all_efforts=false`, { headers: { Authorization: `Bearer ${token}` } }); }
        catch(e){ if(Object.keys(reszletek).length) break; throw new HttpsError('unavailable', 'A Strava most nem érhető el – próbáld újra később.'); }
        if(r.status === 429){ limit = true; break; }
        if(r.status === 401) throw new HttpsError('failed-precondition', 'A Strava-hozzáférés lejárt vagy visszavonták – kösd össze újra.');
        // törölt vagy már nem látható aktivitás: üres részlettel jelezzük, hogy ne kérje újra
        if(r.status === 404 || r.status === 403){ reszletek[id] = {}; continue; }
        if(!r.ok){ if(Object.keys(reszletek).length) break; throw new HttpsError('unavailable', `A Strava hibát jelzett (${r.status}).`); }
        reszletek[id] = reszlet(await r.json());
    }
    return { reszletek, limit };
});

// Pulzuszónák és km-enkénti tempó egy aktivitáshoz. A zónahatárokat a
// sportoló Strava-beállításából vesszük (/athlete/zones), az időt a
// pulzus- és távadatfolyamból (/streams) számoljuk: melyik zónában hány
// másodpercet töltött, és mennyi idő alatt futotta le az egyes kilométereket.
exports.stravaZonak = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const id = String((req.data && req.data.id) || '');
    if(!/^\d{1,20}$/.test(id)) throw new HttpsError('invalid-argument', 'Hibás aktivitás-azonosító.');
    const token = await hozzaferes(uid);
    const get = async url => {
        let r;
        try { r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
        catch(e){ throw new HttpsError('unavailable', 'A Strava most nem érhető el – próbáld újra később.'); }
        if(r.status === 401) throw new HttpsError('failed-precondition', 'A Strava-hozzáférés lejárt vagy visszavonták – kösd össze újra.');
        if(r.status === 429) throw new HttpsError('resource-exhausted', 'A Strava most túl sok kérést kapott – próbáld pár perc múlva.');
        if(r.status === 404 || r.status === 403) return null;
        if(!r.ok) throw new HttpsError('unavailable', `A Strava hibát jelzett (${r.status}).`);
        return r.json();
    };
    const [zonak, fo] = await Promise.all([
        get('https://www.strava.com/api/v3/athlete/zones'),
        get(`https://www.strava.com/api/v3/activities/${id}/streams?keys=heartrate,time,distance&key_by_type=true`),
    ]);
    const hat = (((zonak || {}).heart_rate || {}).zones || []).map(z => [Math.round(z.min || 0), Math.round(z.max || -1)]).slice(0, 5);
    const ido = ((fo || {}).time || {}).data || [], hr = ((fo || {}).heartrate || {}).data || [], tav = ((fo || {}).distance || {}).data || [];
    const zon = hat.length && hr.length ? hat.map(() => 0) : null;
    const km = [];
    let kovKm = 1000, kmKezd = 0;
    for(let i = 1; i < ido.length; i++){
        const dt = Math.min(30, Math.max(0, ido[i] - ido[i - 1]));      // megállásnál ne szaladjon el
        if(zon && hr[i]){
            let z = hat.findIndex(([mn, mx]) => hr[i] >= mn && (mx < 0 || hr[i] < mx));
            if(z < 0) z = hr[i] < hat[0][0] ? 0 : hat.length - 1;
            zon[z] += dt;
        }
        if(tav.length && tav[i] >= kovKm){ km.push(Math.round(ido[i] - kmKezd)); kmKezd = ido[i]; kovKm += 1000; }
    }
    return { zon: zon ? zon.map(Math.round) : null, zhat: hat.length ? hat : null, kmSec: km.length ? km.slice(0, 100) : null };
});

// Az első aktivitás napja: az "after" paraméterrel a Strava a legrégebbitől
// kezdve, növekvő sorrendben ad vissza – az első elem a legelső edzés.
exports.stravaElso = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const token = await hozzaferes(uid);
    let r;
    try { r = await fetch('https://www.strava.com/api/v3/athlete/activities?after=0&per_page=1&page=1', { headers: { Authorization: `Bearer ${token}` } }); }
    catch(e){ throw new HttpsError('unavailable', 'A Strava most nem érhető el – próbáld újra később.'); }
    if(r.status === 401) throw new HttpsError('failed-precondition', 'A Strava-hozzáférés lejárt vagy visszavonták – kösd össze újra.');
    if(r.status === 429) throw new HttpsError('resource-exhausted', 'A Strava most túl sok kérést kapott – próbáld pár perc múlva.');
    if(!r.ok) throw new HttpsError('unavailable', `A Strava hibát jelzett (${r.status}).`);
    const l = await r.json();
    return { elso: Array.isArray(l) && l[0] ? String(l[0].start_date_local || l[0].start_date || '').slice(0, 10) : '' };
});

exports.stravaLevalaszt = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const ref = db.doc(`strava_token/${uid}`);
    const snap = await ref.get();
    if(snap.exists){
        // A Strava oldalán is visszavonjuk, hogy a fiókodban se maradjon engedélyezve.
        try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${snap.data().access_token}` } }); }
        catch(e){ /* ha nem sikerül, a token nálunk akkor is törlődik */ }
        await ref.delete();
    }
    return { ok: true };
});

// ============================================================================
//  LINK-ADATOK a Mentésekhez: egy elmentett link címe, leírása, képe.
//  A böngésző idegen oldalt nem olvashat (CORS), ezért ezt a szerver kéri le.
//  Védelem: csak http(s); belső / magán címre (localhost, 10.x, 192.168.x,
//  169.254.x – a felhő metaadat-szervere –, ::1 stb.) nem megy, átirányításnál
//  sem; legfeljebb 600 KB-ot olvas, 8 mp után feladja.
// ============================================================================
const dnsP = require('node:dns').promises;
const net = require('node:net');
const LINK_OPTS = { region: 'europe-west1', maxInstances: 3, timeoutSeconds: 20 };
function belsoIp(ip){
    if(net.isIPv4(ip)){
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:') && belsoIp(x.slice(7));
}
async function biztonsagosCim(u){
    let url;
    try { url = new URL(u); } catch(e){ throw new HttpsError('invalid-argument', 'Érvénytelen link.'); }
    if(!/^https?:$/.test(url.protocol)) throw new HttpsError('invalid-argument', 'Csak http(s) link menthető.');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if(/^(localhost|metadata(\.google\.internal)?)$/i.test(host) || /\.(local|internal)$/i.test(host)) throw new HttpsError('invalid-argument', 'Belső cím.');
    const cimek = net.isIP(host) ? [{ address: host }] : await dnsP.lookup(host, { all: true }).catch(() => []);
    if(!cimek.length || cimek.some(c => belsoIp(c.address))) throw new HttpsError('invalid-argument', 'A link nem érhető el.');
    return url;
}
const entit = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
function meta(html, nevek){
    for(const n of nevek){
        const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i');
        const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${n}["']`, 'i');
        const m = html.match(re1) || html.match(re2);
        if(m && m[1].trim()) return entit(m[1]);
    }
    return '';
}
exports.linkInfo = onCall(LINK_OPTS, async req => {
    await engedelyezett(req);
    let url = await biztonsagosCim(String((req.data && req.data.url) || '').slice(0, 2000));
    const ctl = new AbortController(), ido = setTimeout(() => ctl.abort(), 8000);
    try {
        let res;
        for(let i = 0; i < 5; i++){
            res = await fetch(url, { redirect: 'manual', signal: ctl.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Eletfuzet/1.0; +link-elonezet)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'hu,en;q=0.8' } });
            if(res.status >= 300 && res.status < 400 && res.headers.get('location')){ url = await biztonsagosCim(new URL(res.headers.get('location'), url).href); continue; }
            break;
        }
        if(!res || !res.ok || !/html/i.test(res.headers.get('content-type') || '')) return { url: url.href };
        const olvaso = res.body.getReader(); let html = '', meret = 0; const dek = new TextDecoder('utf-8');
        while(meret < 600000){ const { done, value } = await olvaso.read(); if(done) break; meret += value.length; html += dek.decode(value, { stream: true }); if(/<\/head>/i.test(html)) break; }
        try { olvaso.cancel(); } catch(e){}
        const cim = meta(html, ['og:title', 'twitter:title']) || entit((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
        let kep = meta(html, ['og:image', 'og:image:url', 'twitter:image']);
        if(kep){ try { kep = new URL(kep, url).href; if(!/^https:/.test(kep)) kep = ''; } catch(e){ kep = ''; } }
        return { url: url.href, cim: cim.slice(0, 300), leiras: meta(html, ['og:description', 'description', 'twitter:description']).slice(0, 500), kep: kep.slice(0, 1000), oldal: meta(html, ['og:site_name']).slice(0, 100) };
    } catch(e){
        if(e instanceof HttpsError) throw e;
        return { url: url.href };
    } finally { clearTimeout(ido); }
});
