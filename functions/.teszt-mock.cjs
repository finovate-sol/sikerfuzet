// Helyi próba a Strava-függvényekhez: a Firestore-t és a Strava API-t álcázza,
// így semmi nem megy ki a hálózatra. Futtatás: node .teszt-mock.cjs
const Module = require('module');
const tar = {};
const docRef = path => ({
    get: async () => ({ exists: path in tar, data: () => tar[path] }),
    set: async (d, o) => {
        if(o && o.merge && tar[path]){
            const m = { ...tar[path] };
            for(const [k, v] of Object.entries(d)) m[k] = (v && typeof v === 'object' && !Array.isArray(v) && m[k] && typeof m[k] === 'object') ? { ...m[k], ...v } : v;
            tar[path] = m;
        } else tar[path] = d;
    },
    delete: async () => { delete tar[path]; },
});
const eredeti = Module._load;
Module._load = function(req, ...rest){
    if(req === 'firebase-admin/app') return { initializeApp: () => ({}) };
    if(req === 'firebase-admin/firestore') return { getFirestore: () => ({ doc: docRef }), FieldValue: { serverTimestamp: () => 'TS' } };
    return eredeti.call(this, req, ...rest);
};
process.env.STRAVA_CLIENT_SECRET = 'titok';
process.env.GCLOUD_PROJECT = 'teszt';
const hivasok = [];
global.fetch = async (url, o = {}) => {
    hivasok.push(url.split('?')[0]);
    const json = x => ({ ok: true, status: 200, json: async () => x });
    if(url.includes('/oauth/token')){
        const b = JSON.parse(o.body);
        if(b.client_secret !== 'titok') return { ok: false, status: 401, json: async () => ({}) };
        return json({ access_token: 'AT' + b.grant_type, refresh_token: 'RT', expires_at: b.grant_type === 'refresh_token' ? 9e9 : 1, athlete: { id: 7, firstname: 'Márk', lastname: 'Szécsi' } });
    }
    if(url.includes('/athlete/activities')){
        if(!String(o.headers.Authorization).includes('ATrefresh_token')) return { ok: false, status: 401, json: async () => ({}) };
        return json([
            { id: 1, name: 'Reggeli futás', sport_type: 'Run', start_date_local: '2026-09-28T07:10:00Z', moving_time: 2520, distance: 7100 },
            { id: 2, name: 'Jóga', sport_type: 'Yoga', start_date_local: '2026-09-27T19:00:00Z', moving_time: 1200, distance: 0 },
            { id: 3, name: 'Régi', sport_type: 'Run', start_date_local: '2026-08-01T07:00:00Z', moving_time: 100, distance: 100 },
        ]);
    }
    if(/\/activities\/\d+$/.test(url.split('?')[0])){
        const id = url.split('?')[0].split('/').pop();
        if(id === '404') return { ok: false, status: 404, json: async () => ({}) };
        if(id === '429') return { ok: false, status: 429, json: async () => ({}) };
        return json({ id: +id, calories: 512.4, device_name: 'Garmin Forerunner 255', description: 'Könnyű kör a parton',
            best_efforts: [{ name: '400m', elapsed_time: 90 }, { name: '1k', elapsed_time: 252 }, { name: '1 mile', elapsed_time: 410 }, { name: '5k', elapsed_time: 1421 }] });
    }
    if(url.includes('/deauthorize')) return json({});
    throw new Error('váratlan url ' + url);
};
const f = require('./index.js');
const kerd = (data, email = 'szecsimark@gmail.com') => ({ data, auth: { uid: 'u1', token: { email } }, rawRequest: {} });
(async () => {
    tar['allowed_users/szecsimark@gmail.com'] = { added: 1 };
    const hiba = async p => { try { await p; return 'NEM DOBOTT'; } catch(e){ return e.code + ': ' + e.message; } };
    console.log('idegen:', await hiba(f.stravaCsatol.run(kerd({ code: 'abcdefghijkl', scope: 'read,activity:read_all' }, 'x@y.hu'))));
    console.log('scope nélkül:', await hiba(f.stravaCsatol.run(kerd({ code: 'abcdefghijkl', scope: 'read' }))));
    console.log('csatol:', JSON.stringify(await f.stravaCsatol.run(kerd({ code: 'abcdefghijkl', scope: 'read,activity:read_all' }))));
    console.log('token a szerveren:', tar['strava_token/u1'].access_token, tar['strava_token/u1'].athleteId);
    const r = await f.stravaSzinkron.run(kerd({ tol: '2026-09-25', ig: '2026-09-28' }));
    console.log('szinkron:', JSON.stringify(r));
    console.log('Firestore-ba írt a szerver:', Object.keys(tar).join(', '));
    console.log('frissített token:', tar['strava_token/u1'].access_token);
    console.log('túl hosszú:', await hiba(f.stravaSzinkron.run(kerd({ tol: '2026-01-01', ig: '2026-09-28' }))));
    console.log('részletek:', JSON.stringify(await f.stravaReszletek.run(kerd({ ids: ['11', '404', '12'] }))));
    console.log('részletek, keret elfogy:', JSON.stringify(await f.stravaReszletek.run(kerd({ ids: ['13', '429', '14'] }))));
    console.log('részletek, túl sok:', await hiba(f.stravaReszletek.run(kerd({ ids: Array.from({ length: 16 }, (_, i) => String(i + 1)) }))));
    console.log('részletek, rossz id:', await hiba(f.stravaReszletek.run(kerd({ ids: ['../x'] }))));
    console.log('levalaszt:', JSON.stringify(await f.stravaLevalaszt.run(kerd({}))), '| maradt:', Object.keys(tar).join(', '));
    console.log('hívott Strava-címek:', [...new Set(hivasok)].join(' '));
})();
