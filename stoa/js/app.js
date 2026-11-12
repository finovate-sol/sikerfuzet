// Stoa – az app központja: belépés, hozzáférés, fülsáv, újrarajzolás, offline.
import { requireAuth, logout, isAdmin, getConfigDoc } from '../../auth.js?v=94';
import { ik } from './ikonok.js';
import { $, esc } from './ui.js';
import { tar, online } from './platform.js';
import * as A from './adat.js';
import * as Ma from './oldalak/ma.js';
import * as Penz from './oldalak/penz.js';
import * as Tobb from './oldalak/tobb.js';
import { naploLap, tetelLap } from './lapok.js';

const OLDAL = { ma: Ma, penz: Penz, tobb: Tobb };
const FUL = [['ma', 'sun', 'Ma'], ['penz', 'wallet', 'Pénz'], ['tobb', 'ellipsis', 'Több']];
let akt = 'ma', USER = null, ADMIN = false, NEV = '';
const nezet = () => $('#nezet');

function rajz(){
    const el = nezet(); if(!el || !USER) return;
    OLDAL[akt].rajz(el, { nev: NEV, offline: !online() || A.kimenoDb() > 0, user: USER, admin: ADMIN });
    $('#fab').hidden = akt === 'tobb';
    $('#felso').textContent = OLDAL[akt].cim;
}
function valt(uj, gorget = true){
    if(!OLDAL[uj]) uj = 'ma';
    if(uj === akt && gorget){ nezet().scrollTo({ top: 0, behavior: 'smooth' }); return; }
    akt = uj; tar.set('ful', akt);
    document.querySelectorAll('.fulsav button').forEach(b => b.classList.toggle('on', b.dataset.ful === akt));
    if(location.hash !== '#' + akt) history.replaceState(null, '', '#' + akt);
    rajz(); nezet().scrollTop = 0; felso();
}
const felso = () => $('#felso').classList.toggle('on', nezet().scrollTop > 50);

function vaz(){
    document.body.insertAdjacentHTML('beforeend', `
        <div class="felso" id="felso"></div>
        <main class="nezet" id="nezet"></main>
        <button type="button" class="fab nyom" id="fab" aria-label="Új">${ik('plus')}</button>
        <nav class="fulsav" aria-label="Stoa">${FUL.map(([k, i, n]) => `<button type="button" data-ful="${k}" class="${k === akt ? 'on' : ''}">${ik(i)}${n}</button>`).join('')}</nav>`);
    nezet().addEventListener('scroll', felso, { passive: true });
    document.querySelector('.fulsav').addEventListener('click', e => { const b = e.target.closest('[data-ful]'); if(b) valt(b.dataset.ful); });
    $('#fab').addEventListener('click', () => akt === 'penz' ? Penz.fab() : uj());
    nezet().addEventListener('click', e => {
        if(e.target.closest('a[href="#penz"]')){ e.preventDefault(); valt('penz'); return; }
        if(e.target.closest('[data-kilep]')){ if(confirm('Kijelentkezel?')) logout('../login.html'); return; }
        if(e.target.closest('[data-frissit]')){ frissit(true); return; }
        const o = OLDAL[akt]; if(o.esemeny) o.esemeny(e, rajz);
    });
    nezet().addEventListener('input', e => { const o = OLDAL[akt]; if(o.bevitel) o.bevitel(e, rajz); });
    addEventListener('hashchange', () => valt(location.hash.slice(1), false));
}
// a ＋ a Ma fülön: választó lap
function uj(){
    import('./ui.js').then(({ lap }) => {
        const { l, zar } = lap('Új', `<div class="bento">
            <button type="button" class="csempe kicsi nyom" data-v="naplo" style="background:var(--naplo);color:var(--naplo-i);min-height:96px"><span class="ikd" style="background:rgba(255,255,255,.6)">${ik('notebook-pen')}</span><b style="font-size:16px;margin-top:auto">Napló</b></button>
            <button type="button" class="csempe kicsi nyom" data-v="tetel" style="background:var(--penz);color:var(--penz-i);min-height:96px"><span class="ikd" style="background:rgba(255,255,255,.6)">${ik('wallet')}</span><b style="font-size:16px;margin-top:auto">Költés</b></button></div><div style="height:6px"></div>`);
        l.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if(!b) return; zar(); setTimeout(() => b.dataset.v === 'naplo' ? naploLap() : tetelLap('ki'), 140); });
    });
}

let frissul = false;
async function frissit(kezi){
    if(frissul || !USER) return; frissul = true;
    try { await A.kimenoUrit(); await A.betolt(); if(kezi) import('./ui.js').then(m => m.toast('Frissítve')); }
    finally { frissul = false; }
}

function kapu(szoveg){
    document.body.insertAdjacentHTML('beforeend', `<main class="nezet"><div class="kapu"><img src="../icons/stoa/icon-192.png" alt="" width="84" height="84" style="border-radius:22px"><b>Stoa</b><span>${szoveg}</span>
        <a class="gomb mas kicsi" href="../index.html?app=siker">Vissza a Sikerfüzetbe</a></div></main>`);
}

// ---------- indulás ----------
if('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
akt = OLDAL[location.hash.slice(1)] ? location.hash.slice(1) : tar.get('ful', 'ma');
requireAuth(async user => {
    USER = user;
    if(!user){ kapu('A Firebase nincs beállítva.'); $('#indulo').classList.add('el'); return; }
    ADMIN = isAdmin(user);
    NEV = String(user.displayName || '').trim().split(/\s+/).slice(-1)[0] || '';
    // hozzáférés: az admin mindig; mások, ha a Stoa hozzáférés-listán vannak (config/szem.uids)
    let ok = ADMIN || tar.get('hozz_' + user.uid, false);
    if(!ADMIN){
        try { const c = await getConfigDoc('szem'); ok = !!(c && Array.isArray(c.uids) && c.uids.includes(user.uid)); tar.set('hozz_' + user.uid, ok); }
        catch(e){ console.warn('Hozzáférés-ellenőrzés offline – a legutóbbi állapot marad.', e); }
    }
    if(!ok){ kapu('A Stoa még nem elérhető a fiókodon. Ha szeretnéd használni, szólj a vezetődnek.'); $('#indulo').classList.add('el'); return; }
    A.init(user.uid);
    A.figyel(rajz);
    vaz(); rajz();
    $('#indulo').classList.add('el');
    await frissit();
    addEventListener('online', () => frissit());
    addEventListener('offline', rajz);
    let rejtve = 0;
    document.addEventListener('visibilitychange', () => { if(document.hidden){ rejtve = Date.now(); return; } if(Date.now() - rejtve > 30000) frissit(); });
    const q = new URLSearchParams(location.search).get('uj');
    if(q){ history.replaceState(null, '', location.pathname + location.hash); if(q === 'naplo') naploLap(); else if(q === 'koltes') tetelLap('ki'); }
}, { login: '../login.html' });
