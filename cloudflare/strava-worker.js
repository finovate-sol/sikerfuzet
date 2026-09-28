// ============================================================================
//  SIKERFÜZET – STRAVA-ÖSSZEKÖTÉS (Cloudflare Worker)
//
//  Miért kell szerver? A Strava a belépési kódot csak a Client Secret-tel
//  együtt cseréli tokenre, és a secret nem kerülhet a GitHub Pages-en futó,
//  bárki által olvasható oldalba. Ez a Worker az egyetlen hely, ahol a secret
//  és a Strava-tokenek élnek – a böngésző egyiket sem látja.
//
//  Végpontok (mind POST, JSON):
//    /csatol     { code, scope } → a Strava-kódot tokenre cseréli, elteszi
//    /szinkron   { tol, ig }     → a napok aktivitásai: { napok: { "2026-09-28": [...] } }
//    /levalaszt                  → visszavonja a hozzáférést, törli a tokent
//  Minden kérésnél kötelező a Firebase-belépés: Authorization: Bearer <ID token>.
//  A Worker ellenőrzi az aláírást, és hogy a felhasználó rajta van-e az
//  engedélyezett listán (allowed_users) – ugyanaz a kapu, mint az appban.
//  Az aktivitásokat az app menti a Firestore-ba (edzes/{uid}_sv{év}).
//
//  BEÁLLÍTÁS a Cloudflare felületén:
//    • Secret:     STRAVA_CLIENT_SECRET  (Settings → Variables and Secrets)
//    • KV-kötés:   STRAVA_KV             (Settings → Bindings → KV namespace)
//  Nincs külső csomag: a kódot egy az egyben be lehet illeszteni a szerkesztőbe.
// ============================================================================

const PROJEKT = 'finovate-sol-sikerfuzet';
const STRAVA_CLIENT_ID = '282966';
// Honnan hívható a Worker (böngésző CORS). A localhost a helyi fejlesztéshez kell.
const ENGEDETT = [/^https:\/\/finovate-sol\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const NAP = /^\d{4}-\d{2}-\d{2}$/;

class Hiba extends Error { constructor(status, uzenet){ super(uzenet); this.status = status; } }

// ---- Firebase ID token ellenőrzése (RS256, a Google nyilvános kulcsaival) ----
let kulcsok = null, kulcsLejar = 0;
async function googleKulcsok(){
    if(kulcsok && Date.now() < kulcsLejar) return kulcsok;
    const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if(!r.ok) throw new Hiba(503, 'A belépés ellenőrzése most nem lehetséges – próbáld újra.');
    const j = await r.json();
    const maxAge = +((r.headers.get('cache-control') || '').match(/max-age=(\d+)/) || [])[1] || 3600;
    kulcsok = Object.fromEntries((j.keys || []).map(k => [k.kid, k]));
    kulcsLejar = Date.now() + maxAge * 1000;
    return kulcsok;
}
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const jsonResz = s => JSON.parse(new TextDecoder().decode(b64u(s)));
async function belepes(req){
    const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
    if(!m) throw new Hiba(401, 'Jelentkezz be újra.');
    const token = m[1], reszek = token.split('.');
    if(reszek.length !== 3) throw new Hiba(401, 'Érvénytelen belépés.');
    let fej, p;
    try { fej = jsonResz(reszek[0]); p = jsonResz(reszek[1]); } catch(e){ throw new Hiba(401, 'Érvénytelen belépés.'); }
    if(fej.alg !== 'RS256') throw new Hiba(401, 'Érvénytelen belépés.');
    const jwk = (await googleKulcsok())[fej.kid];
    if(!jwk) throw new Hiba(401, 'A belépés lejárt – töltsd újra az oldalt.');
    const kulcs = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const jo = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kulcs, b64u(reszek[2]), new TextEncoder().encode(reszek[0] + '.' + reszek[1]));
    const most = Date.now() / 1000;
    if(!jo || p.aud !== PROJEKT || p.iss !== 'https://securetoken.google.com/' + PROJEKT || !p.sub || p.exp < most || p.iat > most + 300)
        throw new Hiba(401, 'A belépés lejárt – töltsd újra az oldalt.');
    return { uid: p.sub, email: String(p.email || '').toLowerCase(), token };
}
// Rajta van-e az engedélyezett listán? A saját allowed_users dokumentumát
// minden felhasználó lekérdezheti (firestore.rules), így ehhez nem kell
// szolgáltatásfiók: a Worker a felhasználó saját belépésével kérdez.
const engedelyCache = new Map();
async function engedelyezett(req){
    const b = await belepes(req);
    const c = engedelyCache.get(b.uid);
    if(c && c > Date.now()) return b.uid;
    if(!b.email) throw new Hiba(403, 'A fiókodhoz nem tartozik email-cím.');
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJEKT}/databases/(default)/documents/allowed_users/${encodeURIComponent(b.email)}`,
                          { headers: { Authorization: 'Bearer ' + b.token } });
    if(r.status === 404 || r.status === 403) throw new Hiba(403, 'Nincs hozzáférésed a Sikerfüzethez.');
    if(!r.ok) throw new Hiba(503, 'A jogosultság ellenőrzése most nem lehetséges – próbáld újra.');
    engedelyCache.set(b.uid, Date.now() + 10 * 60 * 1000);
    return b.uid;
}

// ---- Strava ----
async function stravaToken(env, body){
    let r;
    try {
        r = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...body }),
        });
    } catch(e){ throw new Hiba(502, 'A Strava most nem érhető el – próbáld újra később.'); }
    const j = await r.json().catch(() => ({}));
    if(r.status === 400 || r.status === 401) throw new Hiba(409, 'A Strava elutasította a hozzáférést – kösd össze újra a fiókodat.');
    if(!r.ok) throw new Hiba(502, `A Strava hibát jelzett (${r.status}).`);
    return j;
}
// Érvényes access token; ha lejár (6 óránként), a refresh tokennel frissít.
async function hozzaferes(env, uid){
    const t = await env.STRAVA_KV.get('tok:' + uid, 'json');
    if(!t) throw new Hiba(409, 'A Strava nincs összekötve.');
    if(t.expires_at > Date.now() / 1000 + 120) return t.access_token;
    const u = await stravaToken(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    await env.STRAVA_KV.put('tok:' + uid, JSON.stringify({ ...t, access_token: u.access_token, refresh_token: u.refresh_token, expires_at: u.expires_at }));
    return u.access_token;
}

async function csatol(env, uid, d){
    const code = String(d.code || ''), scope = String(d.scope || '');
    if(!/^[A-Za-z0-9]{10,200}$/.test(code)) throw new Hiba(400, 'Hibás Strava-kód.');
    if(!scope.split(',').some(s => s === 'activity:read' || s === 'activity:read_all'))
        throw new Hiba(409, 'A Stravánál az edzéseid olvasását is engedélyezni kell (a „View data about your activities” pipa).');
    const t = await stravaToken(env, { code, grant_type: 'authorization_code' });
    const a = t.athlete || {};
    await env.STRAVA_KV.put('tok:' + uid, JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token,
                                                          expires_at: t.expires_at, athleteId: a.id || null, scope }));
    return { athleteId: a.id || null, nev: [a.firstname, a.lastname].filter(Boolean).join(' ') || 'Strava-fiók', osszekotve: new Date().toISOString() };
}

async function szinkron(env, uid, d){
    const tol = String(d.tol || ''), ig = String(d.ig || '');
    if(!NAP.test(tol) || !NAP.test(ig) || tol > ig) throw new Hiba(400, 'Hibás időszak.');
    const napok = {};
    for(const x = new Date(tol + 'T00:00:00Z'); ; x.setUTCDate(x.getUTCDate() + 1)){
        const s = x.toISOString().slice(0, 10);
        if(s > ig) break;
        napok[s] = [];
        if(Object.keys(napok).length > 62) throw new Hiba(400, 'Egyszerre legfeljebb 62 nap szinkronizálható.');
    }
    const token = await hozzaferes(env, uid);
    // A Strava UTC-ben szűr, a napot viszont a helyi kezdési idő (start_date_local)
    // adja – ezért mindkét irányban ráhagyunk egy napot, és utána szűrünk.
    const after = Date.parse(tol + 'T00:00:00Z') / 1000 - 86400;
    const before = Date.parse(ig + 'T00:00:00Z') / 1000 + 2 * 86400;
    let db = 0;
    for(let oldal = 1; oldal <= 5; oldal++){
        let r;
        try {
            r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=100&page=${oldal}`,
                            { headers: { Authorization: 'Bearer ' + token } });
        } catch(e){ throw new Hiba(502, 'A Strava most nem érhető el – próbáld újra később.'); }
        if(r.status === 401) throw new Hiba(409, 'A Strava-hozzáférés lejárt vagy visszavonták – kösd össze újra.');
        if(r.status === 429) throw new Hiba(429, 'A Strava most túl sok kérést kapott – próbáld pár perc múlva.');
        if(!r.ok) throw new Hiba(502, `A Strava hibát jelzett (${r.status}).`);
        const lista = await r.json();
        for(const a of lista){
            const s = String(a.start_date_local || '').slice(0, 10);
            if(!napok[s]) continue;
            napok[s].push({ id: String(a.id), n: String(a.name || '').slice(0, 80), tip: a.sport_type || a.type || '',
                            perc: Math.round((a.moving_time || 0) / 60), km: Math.round((a.distance || 0) / 100) / 10 });
            db++;
        }
        if(lista.length < 100) break;
    }
    return { napok, db, utolsoSzinkron: new Date().toISOString() };
}

async function levalaszt(env, uid){
    const t = await env.STRAVA_KV.get('tok:' + uid, 'json');
    if(t){
        // A Strava oldalán is visszavonjuk, hogy a fiókodban se maradjon engedélyezve.
        try { await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: 'Bearer ' + t.access_token } }); }
        catch(e){ /* ha nem sikerül, a token nálunk akkor is törlődik */ }
        await env.STRAVA_KV.delete('tok:' + uid);
    }
    return { ok: true };
}

const UTAK = { '/csatol': csatol, '/szinkron': szinkron, '/levalaszt': levalaszt };

export default {
    async fetch(req, env){
        const origin = req.headers.get('origin') || '';
        const cors = ENGEDETT.some(r => r.test(origin)) ? {
            'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin',
        } : { 'Vary': 'Origin' };
        const valasz = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
        // Más weboldalról érkező kérést ki sem szolgálunk (böngészőből mindig van Origin).
        if(origin && !ENGEDETT.some(r => r.test(origin))) return valasz(403, { hiba: 'Ismeretlen eredet.' });
        if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
        const ut = UTAK[new URL(req.url).pathname];
        if(!ut) return valasz(404, { hiba: 'Ismeretlen végpont.' });
        if(req.method !== 'POST') return valasz(405, { hiba: 'Csak POST.' });
        if(!env.STRAVA_CLIENT_SECRET || !env.STRAVA_KV) return valasz(500, { hiba: 'A Worker nincs beállítva: hiányzik a STRAVA_CLIENT_SECRET vagy a STRAVA_KV.' });
        try {
            const uid = await engedelyezett(req);
            const adat = await req.json().catch(() => ({}));
            return valasz(200, await ut(env, uid, adat || {}));
        } catch(e){
            if(e instanceof Hiba) return valasz(e.status, { hiba: e.message });
            console.error(e);
            return valasz(500, { hiba: 'Váratlan hiba a Strava-szerveren.' });
        }
    },
};
