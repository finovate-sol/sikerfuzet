// ============================================================================
//  SIKERFÜZET – STRAVA-ÖSSZEKÖTÉS (Firebase Cloud Functions, 2. generáció)
//
//  Miért kell szerver? A Strava a belépési kódot csak a Client Secret-tel
//  együtt cseréli tokenre, és a secret nem kerülhet a GitHub Pages-en futó,
//  bárki által olvasható oldalba. Ezért ez a három függvény fut a Firebase-en:
//
//    stravaCsatol    – a Strava-visszairányításból kapott kódot tokenre cseréli
//    stravaSzinkron  – lehúzza a megadott napok aktivitásait
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
            body: JSON.stringify({ client_id: STRAVA_CLIENT_ID, client_secret: STRAVA_CLIENT_SECRET.value(), ...body }),
        });
    } catch(e){ throw new HttpsError('unavailable', 'A Strava most nem érhető el – próbáld újra később.'); }
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
        if(res.status === 400 || res.status === 401)
            throw new HttpsError('failed-precondition', 'A Strava elutasította a hozzáférést – kösd össze újra a fiókodat.');
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

exports.stravaSzinkron = onCall(OPTS, async req => {
    const uid = await engedelyezett(req);
    const { tol, ig } = req.data || {};
    if(!NAP.test(String(tol)) || !NAP.test(String(ig)) || tol > ig) throw new HttpsError('invalid-argument', 'Hibás időszak.');
    const napok = {};
    for(const d = new Date(tol + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)){
        const s = d.toISOString().slice(0, 10);
        if(s > ig) break;
        napok[s] = [];
        if(Object.keys(napok).length > 62) throw new HttpsError('invalid-argument', 'Egyszerre legfeljebb 62 nap szinkronizálható.');
    }
    const token = await hozzaferes(uid);
    // A Strava UTC-ben szűr, a napot viszont a helyi kezdési idő (start_date_local)
    // adja – ezért mindkét irányban ráhagyunk egy napot, és utána szűrünk.
    const after = Date.parse(tol + 'T00:00:00Z') / 1000 - 86400;
    const before = Date.parse(ig + 'T00:00:00Z') / 1000 + 2 * 86400;
    let db_ = 0;
    for(let oldal = 1; oldal <= 5; oldal++){
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
            napok[s].push({ id: String(a.id), n: String(a.name || '').slice(0, 80), tip: a.sport_type || a.type || '',
                            perc: Math.round((a.moving_time || 0) / 60), km: Math.round((a.distance || 0) / 100) / 10 });
            db_++;
        }
        if(lista.length < 100) break;
    }
    return { napok, db: db_, utolsoSzinkron: new Date().toISOString() };
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
