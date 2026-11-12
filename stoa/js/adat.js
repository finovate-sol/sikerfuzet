// Adatréteg: ugyanazokat a Firestore-dokumentumokat olvassa és írja, mint a régi (index.html) privát rész,
// így a kettő párhuzamosan is használható.
//   napló:      privat/{uid}_naplo (beállítások), privat/{uid}_nl{ÉÉÉÉ} { bej:[…] }
//   szokások:   privat/{uid}_szokasok { lista:[…], napok:{ 'ÉÉÉÉ-HH-NN':[id…] } }
//   pénz:       pz_tranz/{uid}_katalogus, pz_tranz/{uid}_torzs, pz_tranz/{uid}_{ÉÉÉÉ-HH} { tetelek:[…] },
//               penzugyek/{uid} (Tervező: months[év][hó] – a tételekből számolt havi összegek)
// Írás: mindig friss olvasás → módosítás → írás, hogy a máshol (más eszközön) rögzítettek ne vesszenek el.
// Net nélkül a művelet a „kimenő” sorba kerül, és amint lesz kapcsolat, feltöltődik (idempotens: azonosító alapján).
import { getPrivatStrict, savePrivat, getPzTranzStrict, savePzTranz, getPenzugyekStrict, savePenzugyek } from '../../auth.js?v=94';
import { tar, online } from './platform.js';
import { maStr, hoStr, hoLep, napPlusz, napIdx } from './ui.js';

let UID = '';
const ures = () => ({ nlBeall: null, nl: {}, szok: null, kat: null, torzs: null, tranz: {}, ido: 0 });
let S = ures();
let kimeno = [];
const figyelok = new Set();
export const figyel = fn => { figyelok.add(fn); return () => figyelok.delete(fn); };
const jelez = () => figyelok.forEach(fn => { try { fn(); } catch(e){ console.warn(e); } });
export const allapot = () => S;
export const kimenoDb = () => kimeno.length;
const cacheMent = () => {
    // a helyi másolatban csak az aktuális és az előző hónap tételei maradnak
    const tartsd = new Set([hoStr(), hoLep(hoStr(), -1)]);
    const tranz = Object.fromEntries(Object.entries(S.tranz).filter(([h]) => tartsd.has(h)));
    tar.set('cache_' + UID, { ...S, tranz });
};

export function init(uid){
    UID = uid;
    S = Object.assign(ures(), tar.get('cache_' + uid, {}));
    kimeno = tar.get('kimeno_' + uid, []);
}

// ---------- betöltés ----------
export async function betolt(){
    const ev = new Date().getFullYear(), ho = hoStr(), elozo = hoLep(ho, -1);
    const r = await Promise.allSettled([
        getPrivatStrict(UID, 'naplo'), getPrivatStrict(UID, 'nl' + ev), getPrivatStrict(UID, 'nl' + (ev - 1)), getPrivatStrict(UID, 'szokasok'),
        getPzTranzStrict(UID, 'katalogus'), getPzTranzStrict(UID, 'torzs'), getPzTranzStrict(UID, ho), getPzTranzStrict(UID, elozo),
    ]);
    const ok = i => r[i].status === 'fulfilled', v = i => r[i].value;
    if(ok(0)) S.nlBeall = v(0) || {};
    if(ok(1)) S.nl[ev] = (v(1) && v(1).bej) || [];
    if(ok(2)) S.nl[ev - 1] = (v(2) && v(2).bej) || [];
    if(ok(3)) S.szok = v(3) || { lista: [], napok: {} };
    if(ok(4)) S.kat = v(4);
    if(ok(5)) S.torzs = v(5) || {};
    if(ok(6)) S.tranz[ho] = (v(6) && v(6).tetelek) || [];
    if(ok(7)) S.tranz[elozo] = (v(7) && v(7).tetelek) || [];
    for(const k of Object.keys(S.nl)) if(+k < ev - 1) delete S.nl[k];
    // a még fel nem töltött műveletek hatása látsszon a friss adaton is
    kimeno.forEach(x => helyi(x));
    S.ido = Date.now(); cacheMent(); jelez();
    return { hiba: r.filter(x => x.status === 'rejected').length };
}
// egy (korábbi) hónap tételei a hónaplapozáshoz
export async function tranzHo(ho){
    if(S.tranz[ho]) return S.tranz[ho];
    try { const d = await getPzTranzStrict(UID, ho); S.tranz[ho] = (d && d.tetelek) || []; }
    catch(e){ console.warn('Hónap betöltése sikertelen:', ho, e); return null; }
    kimeno.filter(x => x.tip === 'tetel' && x.adat.d.slice(0, 7) === ho).forEach(x => helyi(x));
    jelez(); return S.tranz[ho];
}

// ---------- műveletek: helyi hatás azonnal, a szerverre feltöltve (vagy sorba állítva) ----------
function helyi(x){
    const a = x.adat;
    if(x.tip === 'naplo'){ const y = a.d.slice(0, 4); const l = S.nl[y] = S.nl[y] || []; if(!l.some(b => b.id === a.id)) l.push(a); }
    else if(x.tip === 'szokas'){ const d = S.szok = S.szok || { lista: [], napok: {} }; d.napok = d.napok || {};
        const l = (d.napok[a.nap] || []).filter(z => z !== a.id); if(a.on) l.push(a.id); if(l.length) d.napok[a.nap] = l; else delete d.napok[a.nap]; }
    else if(x.tip === 'tetel'){ const ho = a.d.slice(0, 7); if(S.tranz[ho] && !S.tranz[ho].some(t => t.id === a.id)){ S.tranz[ho].push(a); tarcaHelyi(a, 1); } }
    else if(x.tip === 'torol'){ const ho = a.d.slice(0, 7); if(S.tranz[ho] && S.tranz[ho].some(t => t.id === a.id)){ S.tranz[ho] = S.tranz[ho].filter(t => t.id !== a.id); tarcaHelyi(a, -1); } }
}
function tarcaValtozas(torzs, t, jel){
    const w = id => ((torzs && torzs.penztarca) || []).find(x => x.id === id);
    if(t.t === 'atu'){ const a = w(t.p), b = w(t.p2), o = t.o || 0; if(a) a.o = (a.o || 0) - jel * o; if(b) b.o = (b.o || 0) + jel * o; return !!(a || b); }
    if(!t.p) return false;
    const x = w(t.p); if(!x) return false;
    x.o = (x.o || 0) + jel * (t.t === 'bev' ? 1 : -1) * (t.o || 0); return true;
}
const tarcaHelyi = (t, jel) => { if(S.torzs) tarcaValtozas(S.torzs, t, jel); };

const SZERVER = {
    async naplo(a){
        const k = 'nl' + a.d.slice(0, 4), d = (await getPrivatStrict(UID, k)) || {};
        const bej = Array.isArray(d.bej) ? d.bej : [];
        if(!bej.some(b => b.id === a.id)){ bej.push(a); await savePrivat(UID, k, { ...d, bej }); }
        S.nl[a.d.slice(0, 4)] = bej;
    },
    async szokas(a){
        const d = (await getPrivatStrict(UID, 'szokasok')) || { lista: [], napok: {} };
        d.napok = d.napok || {};
        const l = (d.napok[a.nap] || []).filter(z => z !== a.id); if(a.on) l.push(a.id);
        if(l.length) d.napok[a.nap] = l; else delete d.napok[a.nap];
        await savePrivat(UID, 'szokasok', d); S.szok = d;
    },
    async tetel(a){
        const ho = a.d.slice(0, 7), doc = (await getPzTranzStrict(UID, ho)) || {};
        const l = Array.isArray(doc.tetelek) ? doc.tetelek : [];
        if(l.some(t => t.id === a.id)){ S.tranz[ho] = l; return; }      // már fent van (ismételt feltöltés)
        l.push(a); await savePzTranz(UID, ho, { tetelek: l }); S.tranz[ho] = l;
        await tarcaSzerver(a, 1); await tervezo(ho, l);
    },
    async torol(a){
        const ho = a.d.slice(0, 7), doc = (await getPzTranzStrict(UID, ho)) || {};
        const l = Array.isArray(doc.tetelek) ? doc.tetelek : [];
        if(!l.some(t => t.id === a.id)){ S.tranz[ho] = l; return; }
        const uj = l.filter(t => t.id !== a.id);
        await savePzTranz(UID, ho, { tetelek: uj }); S.tranz[ho] = uj;
        await tarcaSzerver(a, -1); await tervezo(ho, uj);
    },
};
async function tarcaSzerver(t, jel){
    if(t.t !== 'atu' && !t.p) return;
    const torzs = (await getPzTranzStrict(UID, 'torzs')) || {};
    if(tarcaValtozas(torzs, t, jel)){ await savePzTranz(UID, 'torzs', torzs); S.torzs = torzs; }
}
// A Tervező havi tény-összegei a tételekből (ugyanaz a számítás, mint a régi pzSyncTervezo)
async function tervezo(ho, lista){
    const [y, m] = ho.split('-').map(Number);
    const data = (await getPenzugyekStrict(UID)) || { kezdo: {}, months: {} };
    const months = data.months || {}, arr = (months[String(y)] || []).slice();
    while(arr.length < 12) arr.push({});
    const sor = { ...(arr[m - 1] || {}) };
    if(!lista.length){
        if(!sor.naplo) return;
        ['bevFo', 'bevOvb', 'bevExtra', 'kolt', 'naplo'].forEach(k => delete sor[k]);
    } else {
        const ossz = { fo: 0, ovb: 0, extra: 0, kolt: 0 };
        for(const t of lista){
            if(pzBe(t)){ const c = bevCel(t.k); ossz[c in ossz ? c : 'extra'] += (t.o || 0); }
            else if(pzKi(t)) ossz.kolt += (t.o || 0);
        }
        if(sor.naplo && sor.bevFo === ossz.fo && sor.bevOvb === ossz.ovb && sor.bevExtra === ossz.extra && sor.kolt === ossz.kolt) return;
        Object.assign(sor, { bevFo: ossz.fo, bevOvb: ossz.ovb, bevExtra: ossz.extra, kolt: ossz.kolt, naplo: true }); delete sor.bev;
    }
    arr[m - 1] = sor;
    await savePenzugyek(UID, { months: { [String(y)]: arr } });
}

// Művelet végrehajtása: helyben azonnal, aztán fel a szerverre; hiba esetén a kimenő sorba.
// Visszaadja: 'ok' | 'sorban' | 'hiba'
export async function muvelet(tip, adat){
    const x = { tip, adat, id: tip + ':' + (adat.id || '') + ':' + (adat.nap || '') + ':' + Date.now() };
    helyi(x); cacheMent(); jelez();
    if(!online()){ sorba(x); return 'sorban'; }
    try { await SZERVER[tip](adat); cacheMent(); jelez(); return 'ok'; }
    catch(e){
        if(e && e.code === 'permission-denied'){ console.warn('Nincs jogosultság:', e); await betolt().catch(() => {}); return 'hiba'; }
        console.warn('Feltöltés később:', e); sorba(x); return 'sorban';
    }
}
function sorba(x){
    // ugyanarra a szokás-napra csak az utolsó állapot számít
    if(x.tip === 'szokas') kimeno = kimeno.filter(y => !(y.tip === 'szokas' && y.adat.id === x.adat.id && y.adat.nap === x.adat.nap));
    kimeno.push(x); tar.set('kimeno_' + UID, kimeno); jelez();
}
let urites = false;
export async function kimenoUrit(){
    if(urites || !kimeno.length || !UID || !online()) return;
    urites = true;
    try {
        for(const x of kimeno.slice()){
            try { await SZERVER[x.tip](x.adat); }
            catch(e){ if(e && e.code === 'permission-denied'){ console.warn('Eldobva (jogosultság):', x, e); } else throw e; }
            kimeno = kimeno.filter(y => y !== x); tar.set('kimeno_' + UID, kimeno);
        }
        cacheMent(); jelez();
    } catch(e){ console.warn('Még nincs kapcsolat:', e); }
    finally { urites = false; }
}

// ========== számítások ==========
// --- napló ---
export const HANG_ALAP = ['', 'szörnyű', 'vacak', 'meh', 'jó', 'király'];
export const HANG_IK = ['', 'angry', 'frown', 'meh', 'smile', 'laugh'];
export const hangSzo = h => ((S.nlBeall && Array.isArray(S.nlBeall.hang) && S.nlBeall.hang[h]) || HANG_ALAP[h] || '');
export const tevek = () => (S.nlBeall && Array.isArray(S.nlBeall.tev)) ? S.nlBeall.tev : [];
export const osszesBej = () => Object.values(S.nl).flat();
export const napBej = s => osszesBej().filter(b => b.d === s).sort((a, b) => String(a.ido || '').localeCompare(String(b.ido || '')));
export function naploSorozat(){
    const napok = new Set(osszesBej().map(b => b.d));
    let s = maStr(), n = 0;
    if(!napok.has(s)) s = napPlusz(s, -1);       // a mai még nem töri meg
    while(napok.has(s)){ n++; s = napPlusz(s, -1); }
    return { n, maKesz: napok.has(maStr()) };
}
export function gyakoriTevek(){
    const db = {}; osszesBej().forEach(b => (b.tev || []).forEach(t => db[t] = (db[t] || 0) + 1));
    return tevek().slice().sort((a, b) => (db[b.id] || 0) - (db[a.id] || 0));
}

// --- szokások (ugyanaz a logika, mint a régi szokás-modulban) ---
const szHeti = h => h.het > 0 && h.het < 7;
const szEsedekes = (h, s) => s >= (h.uj || '2000-01-01') && (szHeti(h) || !h.napok || !h.napok.length || h.napok.includes(napIdx(s)));
export const szKesz = (h, s) => (((S.szok && S.szok.napok) || {})[s] || []).includes(h.id);
const szHetEleje = s => napPlusz(s, -napIdx(s));
const szHetDb = (h, s) => { const e = szHetEleje(s); let n = 0; for(let i = 0; i < 7; i++) if(szKesz(h, napPlusz(e, i))) n++; return n; };
const szSzamit = (h, s) => szEsedekes(h, s) && (!szHeti(h) || szKesz(h, s) || szHetDb(h, s) < h.het);
export const szAktiv = () => ((S.szok && S.szok.lista) || []).filter(h => !h.arch);
export const szMai = () => szAktiv().filter(h => szSzamit(h, maStr()));
export function szSorozat(h){
    if(szHeti(h)){
        let e = szHetEleje(maStr()), n = 0, lep = 0;
        if(szHetDb(h, e) < h.het) e = napPlusz(e, -7);
        while(napPlusz(e, 6) >= (h.uj || '2000-01-01') && lep++ < 200){ if(szHetDb(h, e) >= h.het) n++; else break; e = napPlusz(e, -7); }
        return n;
    }
    let s = maStr(), n = 0, lep = 0;
    if(szEsedekes(h, s) && !szKesz(h, s)) s = napPlusz(s, -1);
    while(s >= (h.uj || '2000-01-01') && lep++ < 800){ if(szEsedekes(h, s)){ if(szKesz(h, s)) n++; else break; } s = napPlusz(s, -1); }
    return n;
}
export const szAlszo = h => { const n = szSorozat(h); if(szHeti(h)) return `Heti ${h.het}× · ezen a héten ${szHetDb(h, maStr())}` + (n ? ` · ${n} hetes sorozat` : '');
    return n ? `${n} napos sorozat` : (h.napok && h.napok.length ? h.napok.map(i => ['H','K','Sze','Cs','P','Szo','V'][i]).join(', ') : 'Minden nap'); };
// a régi életterület-kulcsok → Stoa pasztell párok
export const TER_SZIN = { eg: 'egeszseg', sp: 'szokas', pe: 'penz', cs: 'kapcs', sz: 'cel', ov: 'fejl' };

// --- pénz ---
export const pzKi = t => t.t !== 'bev' && t.t !== 'atu' && !t.kh;
export const pzBe = t => t.t === 'bev' && !t.kh;
const KAT_ALAP = { kiadas: [{ n: 'Étel', i: 'etel', c: 'zold' }, { n: 'Közlekedés', i: 'kozlekedes', c: 'sarga' }, { n: 'Otthon', i: 'otthon', c: 'rozsa' }, { n: 'Szórakozás', i: 'pohar', c: 'kek' }, { n: 'Vásárlás', i: 'taska', c: 'lila' }, { n: 'Egyéb', i: 'doboz', c: 'szurke' }],
                   bevetel: [{ n: 'Munkabér', i: 'epulet', c: 'zold', cel: 'fo' }, { n: 'Extra bevétel', i: 'penz', c: 'zold', cel: 'extra' }] };
const katSor = x => Array.isArray(x) ? { n: x[0], al: x[1] || [], cel: x[2], i: 'cimke', c: 'szurke' } : { al: [], c: 'szurke', ...x };
export const katLista = tip => { const k = (S.kat && Array.isArray(S.kat[tip === 'bev' ? 'bevetel' : 'kiadas'])) ? S.kat[tip === 'bev' ? 'bevetel' : 'kiadas'] : KAT_ALAP[tip === 'bev' ? 'bevetel' : 'kiadas']; return k.map(katSor); };
export const katOf = (tip, n) => katLista(tip).find(x => x.n === n) || null;
const bevCel = n => { const k = katOf('bev', n); return (k && k.cel) || 'extra'; };
// a régi színnevek → Stoa pasztell párok
const SZIN = { zold: 'penz', kek: 'szokas', sarga: 'naplo', borostyan: 'naplo', lila: 'cel', rozsa: 'kapcs', piros: 'egeszseg', turkiz: 'fejl', szurke: 'otthon', palaszurke: 'semleges', sotet: 'erdo' };
export const katSzin = (tip, n) => { const k = katOf(tip, n); return SZIN[(k && k.c) || 'szurke'] || 'otthon'; };
export const tarcak = () => ((S.torzs && S.torzs.penztarca) || []);
export const celok = () => ((S.torzs && S.torzs.cel) || []).filter(c => !c.kesz);
export const hoTetelek = ho => S.tranz[ho] || null;
export function honapOssz(ho){
    const l = S.tranz[ho] || [];
    return { be: l.filter(pzBe).reduce((s, t) => s + (t.o || 0), 0), ki: l.filter(pzKi).reduce((s, t) => s + (t.o || 0), 0) };
}
export function keret(ho = hoStr()){
    const keretes = katLista('ki').filter(k => (k.k || 0) > 0), nevek = new Set(keretes.map(k => k.n));
    const osszeg = keretes.reduce((s, k) => s + (k.k || 0), 0);
    const l = S.tranz[ho] || [];
    const kolt = l.filter(t => pzKi(t) && nevek.has(t.k || 'Egyéb')).reduce((s, t) => s + (t.o || 0), 0);
    const [y, m] = ho.split('-').map(Number), most = new Date();
    const hossz = new Date(y, m, 0).getDate(), hatra = ho === hoStr() ? hossz - most.getDate() + 1 : 0;
    return { osszeg, kolt, maradt: osszeg - kolt, hatra, keretes };
}
export function katKoltes(ho, tip = 'ki'){
    const m = new Map();
    (S.tranz[ho] || []).filter(tip === 'ki' ? pzKi : pzBe).forEach(t => m.set(t.k || 'Egyéb', (m.get(t.k || 'Egyéb') || 0) + (t.o || 0)));
    return m;
}
// a gyakran használt kategóriák elöl (az utolsó két hónap alapján)
export function katSorrend(tip){
    const db = {}; Object.values(S.tranz).flat().filter(t => (tip === 'bev' ? pzBe(t) : pzKi(t))).forEach(t => db[t.k] = (db[t.k] || 0) + 1);
    return katLista(tip).slice().sort((a, b) => (db[b.n] || 0) - (db[a.n] || 0));
}
export const aktTarca = () => { const id = tar.get('tarca_' + UID, ''); return tarcak().some(w => w.id === id) ? id : ''; };
export const aktTarcaMent = id => tar.set('tarca_' + UID, id || '');
