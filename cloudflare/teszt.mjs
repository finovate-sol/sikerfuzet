// Helyi próba a Workerhez (Node 22): saját kulccsal aláírt Firebase-tokennel,
// álcázott Google-, Firestore- és Strava-válaszokkal – semmi nem megy ki a
// hálózatra. Futtatás: node cloudflare/teszt.mjs
import worker from './strava-worker.js';

const { privateKey, publicKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = b => Buffer.from(b).toString('base64url');
async function token(claims, kulcs = privateKey){
    const most = Math.floor(Date.now() / 1000);
    const fej = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
    const p = b64u(JSON.stringify({ aud: 'finovate-sol-sikerfuzet', iss: 'https://securetoken.google.com/finovate-sol-sikerfuzet',
                                    sub: 'u1', email: 'SzecsiMark@gmail.com', iat: most, exp: most + 3600, ...claims }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kulcs, new TextEncoder().encode(fej + '.' + p));
    return `${fej}.${p}.${b64u(sig)}`;
}
const kv = new Map();
const env = { STRAVA_CLIENT_SECRET: 'titok', STRAVA_KV: {
    get: async (k, t) => kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null,
    put: async (k, v) => { kv.set(k, v); }, delete: async k => { kv.delete(k); } } };
const hivas = [];
globalThis.fetch = async (url, o = {}) => {
    hivas.push(String(url).split('?')[0]);
    const json = (x, st = 200, h = {}) => new Response(JSON.stringify(x), { status: st, headers: h });
    if(url.includes('securetoken@system')) return json({ keys: [jwk] }, 200, { 'cache-control': 'public, max-age=20000' });
    if(url.includes('firestore.googleapis.com')) return url.endsWith('/szecsimark%40gmail.com') ? json({ name: 'x' }) : json({}, 404);
    if(url.includes('/oauth/token')){
        const b = JSON.parse(o.body);
        if(b.client_secret !== 'titok') return json({}, 401);
        return json({ access_token: 'AT-' + b.grant_type, refresh_token: 'RT', expires_at: b.grant_type === 'refresh_token' ? 9e9 : 1,
                      athlete: { id: 7, firstname: 'Márk', lastname: 'Szécsi' } });
    }
    if(url.includes('/athlete/activities')){
        if(!String(o.headers.Authorization).includes('AT-refresh_token')) return json({}, 401);
        return json([
            { id: 1, name: 'Reggeli futás', sport_type: 'Run', start_date_local: '2026-09-28T07:10:00Z', moving_time: 2520, distance: 7100 },
            { id: 2, name: 'Jóga', sport_type: 'Yoga', start_date_local: '2026-09-27T19:00:00Z', moving_time: 1200, distance: 0 },
            { id: 3, name: 'Régi', sport_type: 'Run', start_date_local: '2026-08-01T07:00:00Z', moving_time: 100, distance: 100 },
        ]);
    }
    if(url.includes('/deauthorize')) return json({});
    throw new Error('váratlan url ' + url);
};
const ORIGIN = 'https://finovate-sol.github.io';
async function k(ut, adat, tok, extra = {}){
    const r = await worker.fetch(new Request('https://sikerfuzet-strava.x.workers.dev' + ut, {
        method: extra.method || 'POST', headers: { origin: extra.origin || ORIGIN, ...(tok ? { authorization: 'Bearer ' + tok } : {}), 'content-type': 'application/json' },
        body: extra.method === 'OPTIONS' ? undefined : JSON.stringify(adat || {}) }), env);
    const t = await r.text();
    return `${r.status} ${r.headers.get('access-control-allow-origin') || '-'} ${t.slice(0, 160)}`;
}
const jo = await token({});
console.log('preflight:', await k('/szinkron', null, null, { method: 'OPTIONS' }));
console.log('idegen origin:', await k('/szinkron', {}, jo, { origin: 'https://gonosz.example' }));
console.log('token nélkül:', await k('/csatol', {}, null));
console.log('lejárt token:', await k('/csatol', {}, await token({ exp: 100 })));
const { privateKey: masik } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
console.log('hamis aláírás:', await k('/csatol', {}, await token({}, masik)));
console.log('más projekt:', await k('/csatol', {}, await token({ aud: 'masik-projekt' })));
console.log('nincs a listán:', await k('/csatol', {}, await token({ sub: 'u2', email: 'idegen@x.hu' })));
console.log('összekötés nélkül szinkron:', await k('/szinkron', { tol: '2026-09-25', ig: '2026-09-28' }, jo));
console.log('scope nélkül:', await k('/csatol', { code: 'abcdefghijkl', scope: 'read' }, jo));
console.log('csatol:', await k('/csatol', { code: 'abcdefghijkl', scope: 'read,activity:read_all' }, jo));
console.log('KV:', [...kv.keys()].join(', '), JSON.parse(kv.get('tok:u1')).access_token);
console.log('szinkron:', await k('/szinkron', { tol: '2026-09-25', ig: '2026-09-28' }, jo));
console.log('frissített token:', JSON.parse(kv.get('tok:u1')).access_token);
console.log('túl hosszú:', await k('/szinkron', { tol: '2026-01-01', ig: '2026-09-28' }, jo));
console.log('levalaszt:', await k('/levalaszt', {}, jo), '| KV:', [...kv.keys()].join(', ') || '(üres)');
console.log('ismeretlen út:', await k('/semmi', {}, jo));
console.log('beállítás nélkül:', (await worker.fetch(new Request('https://x/csatol', { method: 'POST', headers: { origin: ORIGIN } }), {})).status);
console.log('Google-kulcsok letöltése:', hivas.filter(u => u.includes('securetoken')).length, 'alkalommal (gyorsítótár)');
