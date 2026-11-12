// Pénz: Áttekintés · Hónap (keretek) · Tételek. Hónaplapozás, új tétel, tétel részletei.
import { ik, PZ_IK } from '../ikonok.js';
import { esc, ft, hoStr, hoLep, hoNev, napSzo, gyuru, ill } from '../ui.js';
import * as A from '../adat.js';
import { tetelLap, tetelReszlet } from '../lapok.js';

export const cim = 'Pénz';
let nezet = 'attek', ho = hoStr(), szuro = 'mind', kereses = '';
const RES = '../index.html?app=elet&lap=penzugyek';
const KAT_HEX = { penz: '#2f6f55', szokas: '#2f6593', naplo: '#b8860b', cel: '#5b4a9a', kapcs: '#a8445a', egeszseg: '#b0532a', fejl: '#23756d', otthon: '#7a6340', semleges: '#4b5a53', erdo: '#1f5c4a' };

export function rajz(el, { offline = false } = {}){
    const lista = A.hoTetelek(ho);
    if(!lista){ A.tranzHo(ho); }
    const fej = `<div class="fej"><div><div class="d">Pénz</div><h1>${nezet === 'attek' ? 'Áttekintés' : nezet === 'honap' ? 'Hónap' : 'Tételek'}</h1></div>
        <div class="hoval"><button type="button" data-ho="-1" aria-label="Előző hónap">${ik('chevron-left')}</button><b>${esc(hoNev(ho))}</b><button type="button" data-ho="1" aria-label="Következő hónap"${ho >= hoStr() ? ' disabled' : ''}>${ik('chevron-right')}</button></div></div>
        ${offline ? `<div class="offline">${ik('wifi-off')}Nincs net – amit rögzítesz, feltöltöm, amint lesz.</div>` : ''}
        <div class="szeg" style="margin-bottom:14px">${[['attek', 'Áttekintés'], ['honap', 'Hónap'], ['tetel', 'Tételek']].map(([k, n]) => `<button type="button" data-nezet="${k}" class="${nezet === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    let tart = '';
    if(!lista) tart = `<div class="k"><div class="ures">${ill('ures_lap')}<b>Betöltés…</b></div></div>`;
    else if(nezet === 'attek') tart = attek(lista);
    else if(nezet === 'honap') tart = honap(lista);
    else tart = tetelek(lista);
    el.innerHTML = `<div class="belso">${fej}${tart}</div>`;
}

function attek(lista){
    const kr = A.keret(ho), o = A.honapOssz(ho), e = A.honapOssz(hoLep(ho, -1)), vanE = !!A.hoTetelek(hoLep(ho, -1));
    const p = kr.osszeg ? Math.min(100, Math.round(kr.kolt / kr.osszeg * 100)) : 0;
    const valt = (most, elotte, jo) => { if(!vanE || !elotte) return ''; const d = Math.round((most - elotte) / elotte * 100); if(!d) return 'mint az előző hónapban';
        return `${d > 0 ? '↑' : '↓'} ${Math.abs(d)}% az előző hónaphoz`; };
    const w = A.tarcak(), c = A.celok();
    const ikTarca = x => x.tipus === 'keszpenz' ? ['banknote', 'naplo'] : x.tipus === 'megtakaritas' ? ['piggy-bank', 'cel'] : x.tipus === 'kartya' ? ['credit-card', 'szokas'] : ['landmark', 'penz'];
    return `
        <div class="csempe hos" style="min-height:0"><span class="dek">${ik('piggy-bank')}</span>
            ${kr.osszeg ? `<span class="c">${ho === hoStr() ? 'Maradt a havi keretből' : 'Keretből maradt'}</span><span class="v szam">${ft(Math.max(0, kr.maradt))}<small>Ft</small></span>
            <div class="sav${p >= 100 ? ' tul' : p >= 85 ? ' figy' : ''}"><i style="width:${p}%"></i></div>
            <span class="s" style="display:flex;justify-content:space-between;margin-top:8px"><span>${ft(kr.kolt)} / ${ft(kr.osszeg)} Ft</span>${ho === hoStr() && kr.maradt > 0 ? `<span>≈ ${ft(kr.maradt / Math.max(1, kr.hatra))} Ft / nap</span>` : ''}</span>`
            : `<span class="c">Elköltve</span><span class="v szam">${ft(o.ki)}<small>Ft</small></span><span class="s">Havi keretet a teljes nézetben adhatsz a kategóriáknak.</span>`}
        </div>
        <div class="bento" style="margin-top:10px">
            <div class="csempe kicsi" style="background:var(--penz);color:var(--penz-i)"><span class="c">${ik('arrow-down-left')}Bevétel</span><span class="v szam">${ft(o.be)}</span><span class="s">${valt(o.be, e.be)}</span></div>
            <div class="csempe kicsi" style="background:var(--egeszseg);color:var(--egeszseg-i)"><span class="c">${ik('arrow-up-right')}Kiadás</span><span class="v szam">${ft(o.ki)}</span><span class="s">${valt(o.ki, e.ki)}</span></div>
        </div>
        ${w.length ? `<div class="szak">Tárcák<a href="${RES}">Kezelés</a></div><div class="tarcak">${w.map(x => { const [i, sz] = ikTarca(x);
            return `<div class="tarca" style="background:var(--${sz});color:var(--${sz}-i)"><span class="ikd">${ik(i)}</span><span>${esc(x.n)}</span><b class="szam">${ft(x.o)} Ft</b></div>`; }).join('')}</div>` : ''}
        ${c.length ? `<div class="szak">Megtakarítási célok<a href="${RES}">Mind</a></div><div class="k lista">${c.slice(0, 4).map((x, i) => { const sz = ['fejl', 'cel', 'naplo', 'kapcs'][i % 4];
            return `<div class="sor">${gyuru(x.cel ? (x.jelen || 0) / x.cel : 0, `var(--${sz}-i)`, `var(--${sz})`, 44)}<span class="n"><b>${esc(x.n)}</b><span class="szam">${ft(x.jelen)} / ${ft(x.cel)} Ft</span></span></div>`; }).join('')}</div>` : ''}
        <div class="szak">Még több</div>
        <div class="racs3">${[['repeat', 'szokas', 'Előfizetések'], ['scale', 'otthon', 'Vagyon'], ['credit-card', 'kapcs', 'Hitel'], ['hand-coins', 'penz', 'Kint lévő pénz'], ['heart', 'egeszseg', 'Kívánságlista'], ['chart-pie', 'cel', 'Tervező']]
            .map(([i, sz, n]) => `<a class="nyom" href="${RES}" style="background:var(--${sz});color:var(--${sz}-i)"><span class="ikd">${ik(i)}</span>${n}</a>`).join('')}</div>
        <div class="szak">Legutóbbi tételek<button type="button" data-nezet="tetel">Mind</button></div>
        ${tetelLista(lista.slice().sort(rend).slice(0, 5))}`;
}
const rend = (a, b) => (b.d + (b.ido || '')).localeCompare(a.d + (a.ido || ''));

function honap(lista){
    const koltes = A.katKoltes(ho), ossz = [...koltes.values()].reduce((s, v) => s + v, 0);
    const sorok = [...koltes.entries()].sort((a, b) => b[1] - a[1]);
    let off = 0;
    const ivek = sorok.map(([n, v]) => { const d = v / (ossz || 1) * 94.25, s = `<circle cx="18" cy="18" r="15" fill="none" stroke="${KAT_HEX[A.katSzin('ki', n)]}" stroke-width="5" stroke-dasharray="${Math.max(0, d - .6).toFixed(2)} ${(94.25 - d + .6).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += d; return s; }).join('');
    const kr = A.keret(ho), keretes = kr.keretes.slice().sort((a, b) => (koltes.get(b.n) || 0) / (b.k || 1) - (koltes.get(a.n) || 0) / (a.k || 1));
    const nelkul = sorok.filter(([n]) => !kr.keretes.some(k => k.n === n));
    const katIk = n => { const k = A.katOf('ki', n), sz = A.katSzin('ki', n); return `<span class="ikd" style="background:var(--${sz});color:var(--${sz}-i)">${ik(PZ_IK[k && k.i] || 'tag')}</span>`; };
    return `
        <div class="k">${ossz ? `<div class="fank"><div class="kor"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--soft)" stroke-width="5"/>${ivek}</svg><div class="kozep"><b class="szam">${ft(ossz)}</b><span>Ft kiadás</span></div></div>
            <div class="jelm">${sorok.slice(0, 6).map(([n, v]) => `<div><i style="background:${KAT_HEX[A.katSzin('ki', n)]}"></i>${esc(n)} · ${Math.round(v / ossz * 100)}%</div>`).join('')}</div></div>`
            : `<div class="ures">${ill('persely')}<b>Ebben a hónapban még nincs kiadás</b></div>`}</div>
        ${keretes.length ? `<div class="szak">Keretek<a href="${RES}">Szerkesztés</a></div><div class="k lista">${keretes.map(k => { const v = koltes.get(k.n) || 0, p = Math.round(v / k.k * 100);
            const sz = A.katSzin('ki', k.n), cls = p >= 100 ? ' tul' : p >= 85 ? ' figy' : '';
            return `<div class="kat"><div class="f">${katIk(k.n)}<b>${esc(k.n)}</b><span class="szam">${ft(v)}</span><em class="szam">/ ${ft(k.k)}</em></div><div class="sav${cls}"><i style="width:${Math.min(100, p)}%;background:${KAT_HEX[sz]}"></i></div>
                ${p >= 85 ? `<div class="al" style="color:${p >= 100 ? 'var(--err)' : 'var(--warn)'}">${p >= 100 ? `Túllépve ${ft(v - k.k)} Ft-tal` : `${p}% – még ${ft(k.k - v)} Ft`}</div>` : ''}</div>`; }).join('')}</div>` : ''}
        ${nelkul.length ? `<div class="szak">Keret nélkül</div><div class="k lista">${nelkul.map(([n, v]) => `<div class="kat"><div class="f">${katIk(n)}<b>${esc(n)}</b><span class="szam">${ft(v)}</span><em>Ft</em></div></div>`).join('')}</div>` : ''}`;
}

function tetelek(lista){
    const q = kereses.trim().toLowerCase();
    let l = lista.filter(t => szuro === 'mind' || (szuro === 'ki' ? A.pzKi(t) : szuro === 'bev' ? A.pzBe(t) : t.t === 'atu'));
    if(q) l = l.filter(t => [t.m, t.k, t.a, ...(t.tg || [])].join(' ').toLowerCase().includes(q));
    l.sort(rend);
    const napok = []; l.forEach(t => { const u = napok[napok.length - 1]; if(u && u[0] === t.d) u[1].push(t); else napok.push([t.d, [t]]); });
    return `<label class="kereso">${ik('search')}<input type="search" data-keres placeholder="Keresés: bolt, kategória, megjegyzés…" value="${esc(kereses)}"></label>
        <div class="chipek" style="margin:10px -16px 0">${[['mind', 'Mind'], ['ki', 'Kiadás'], ['bev', 'Bevétel'], ['atu', 'Átutalás']].map(([k, n]) => `<button type="button" class="chip${szuro === k ? ' on' : ''}" data-szuro="${k}">${n}</button>`).join('')}</div>
        ${napok.length ? napok.map(([d, ts]) => { const egy = ts.reduce((s, t) => s + (A.pzBe(t) ? 1 : A.pzKi(t) ? -1 : 0) * (t.o || 0), 0);
            return `<div class="napfej"><span>${esc(napSzo(d).toUpperCase())}</span><span class="szam">${egy > 0 ? '+' : egy < 0 ? '−' : ''}${ft(Math.abs(egy))} Ft</span></div>${tetelLista(ts)}`; }).join('')
            : `<div class="k" style="margin-top:12px"><div class="ures">${ill('ures_lap')}<b>${q || szuro !== 'mind' ? 'Nincs találat' : 'Ebben a hónapban még nincs tétel'}</b><span>A ＋ gombbal rögzíthetsz.</span></div></div>`}`;
}
function tetelLista(ts){
    if(!ts.length) return `<div class="k"><div class="ures" style="padding:6px">${ill('ures_lap')}<b>Még nincs tétel</b></div></div>`;
    const w = id => (A.tarcak().find(x => x.id === id) || {}).n;
    return `<div class="k lista">${ts.map(t => { const tip = t.t === 'bev' ? 'bev' : 'ki', k = A.katOf(tip, t.k), sz = t.t === 'atu' ? 'semleges' : A.katSzin(tip, t.k);
        const al = [t.t === 'atu' ? `${w(t.p) || '?'} → ${w(t.p2) || '?'}` : t.k, t.ido, w(t.p) && t.t !== 'atu' ? w(t.p) : ''].filter(Boolean).join(' · ');
        return `<button type="button" class="sor" data-tetel="${esc(t.id)}"><span class="ikd" style="background:var(--${sz});color:var(--${sz}-i)">${ik(t.t === 'atu' ? 'arrow-left-right' : PZ_IK[k && k.i] || 'tag')}</span>
            <span class="n"><b>${esc(t.m || t.k || (t.t === 'atu' ? 'Átutalás' : 'Tétel'))}${t.elo ? '<span class="jelzo" style="background:var(--szokas);color:var(--szokas-i)">előfizetés</span>' : ''}</b><span>${esc(al)}</span></span>
            <span class="j szam${t.t === 'bev' ? ' be' : ''}">${t.t === 'bev' ? '+' : t.t === 'atu' ? '' : '−'}${ft(t.o)} Ft</span></button>`; }).join('')}</div>`;
}

export function esemeny(e, ujra){
    const n = e.target.closest('[data-nezet]'); if(n){ nezet = n.dataset.nezet; ujra(); document.querySelector('.nezet:not([hidden])')?.scrollTo({ top: 0 }); return true; }
    const h = e.target.closest('[data-ho]'); if(h){ ho = hoLep(ho, +h.dataset.ho); if(ho > hoStr()) ho = hoStr(); ujra(); A.tranzHo(ho); return true; }
    const s = e.target.closest('[data-szuro]'); if(s){ szuro = s.dataset.szuro; ujra(); return true; }
    const t = e.target.closest('[data-tetel]'); if(t){ const x = (A.hoTetelek(ho) || []).find(y => y.id === t.dataset.tetel); if(x) tetelReszlet(x); return true; }
    return false;
}
export function bevitel(e, ujra){
    if(!e.target.matches('[data-keres]')) return;
    kereses = e.target.value; const poz = e.target.selectionStart;
    ujra(); const i = document.querySelector('[data-keres]'); if(i){ i.focus(); try { i.setSelectionRange(poz, poz); } catch(_) {} }
}
export const fab = () => tetelLap(nezet === 'tetel' && szuro === 'bev' ? 'bev' : 'ki');
