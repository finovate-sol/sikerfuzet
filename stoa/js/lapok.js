// Felcsúszó lapok: napló-bejegyzés, új pénzügyi tétel, tétel részletei.
import { ik, PZ_IK } from './ikonok.js';
import { esc, ft, lap, toast, maStr, napPlusz, idoStr, ujId, napSzo } from './ui.js';
import { rezeg } from './platform.js';
import * as A from './adat.js';

const visszajelez = (r, okSzo) => {
    if(r === 'ok') toast(okSzo);
    else if(r === 'sorban') toast('Elmentve – feltöltöm, amint lesz net', 'wifi-off', 'var(--warn)');
    else toast('Nem sikerült menteni', 'x', 'var(--err)');
};

// ---------- napló ----------
export function naploLap(){
    const x = { h: 0, tev: [] }; let mind = false;
    const este = new Date().getHours() >= 17;
    const { l, zar } = lap(este ? 'Hogy telt a napod?' : 'Hogy vagy most?', `
        <div class="hangok">${[1, 2, 3, 4, 5].map(h => `<button type="button" class="hang nyom" data-h="${h}">${ik(A.HANG_IK[h])}${esc(A.hangSzo(h))}</button>`).join('')}</div>
        <div id="nlTev"></div>
        <div class="szak" style="margin-top:18px">Jegyzet</div>
        <textarea class="mezo" id="nlMegj" placeholder="${este ? 'Mi ment ma jól? Mi volt a nap legjobb pillanata?' : 'Mi jár a fejedben?'}"></textarea>
        <button type="button" class="gomb fo nyom" id="nlMent" style="margin-top:14px" disabled>Mentés</button>`);
    const tevRajz = () => {
        const lst = A.gyakoriTevek(); const el = l.querySelector('#nlTev');
        if(!lst.length){ el.innerHTML = ''; return; }
        const lat = mind ? lst : lst.slice(0, 10);
        el.innerHTML = `<div class="szak" style="margin-top:18px">Mit csináltál?</div><div style="display:flex;flex-wrap:wrap;gap:7px">${lat.map(t => `<button type="button" class="chip nyom${x.tev.includes(t.id) ? ' on' : ''}" data-t="${esc(t.id)}">${esc(t.n)}</button>`).join('')}${!mind && lst.length > 10 ? '<button type="button" class="chip" data-tobb style="background:none;color:var(--acc)">Több…</button>' : ''}</div>`;
    };
    tevRajz();
    const gomb = l.querySelector('#nlMent'), megj = l.querySelector('#nlMegj');
    const allapot = () => { gomb.disabled = !(x.h || x.tev.length || megj.value.trim()); };
    megj.addEventListener('input', allapot);
    l.addEventListener('click', async e => {
        const h = e.target.closest('[data-h]');
        if(h){ x.h = +h.dataset.h; rezeg(); l.querySelectorAll('.hang').forEach(b => b.classList.toggle('on', +b.dataset.h === x.h)); allapot(); return; }
        const t = e.target.closest('[data-t]');
        if(t){ const id = t.dataset.t; x.tev = x.tev.includes(id) ? x.tev.filter(z => z !== id) : [...x.tev, id]; t.classList.toggle('on'); rezeg(); allapot(); return; }
        if(e.target.closest('[data-tobb]')){ mind = true; tevRajz(); return; }
        if(e.target.closest('#nlMent')){
            gomb.disabled = true;
            const m = megj.value.trim();
            const uj = { id: ujId('p'), d: maStr(), ido: idoStr(), ...(x.h ? { h: x.h } : {}), tev: x.tev.slice(), ...(m ? { megj: m } : {}) };
            zar(); rezeg(15);
            visszajelez(await A.muvelet('naplo', uj), 'Napló mentve');
        }
    });
}

// ---------- új tétel ----------
export function tetelLap(alapTip = 'ki'){
    let tip = alapTip, osszeg = '', kat = '', tarca = A.aktTarca(), tarca2 = '', nap = maStr();
    const { l, zar } = lap('Új tétel', `
        <div class="szeg" id="tTip">${[['ki', 'Kiadás'], ['bev', 'Bevétel'], ['atu', 'Átutalás']].map(([k, n]) => `<button type="button" data-tip="${k}">${n}</button>`).join('')}</div>
        <div class="osszeg szam ures" id="tOssz">0<small>Ft</small></div>
        <div class="info" id="tInfo"></div>
        <div id="tKat"></div>
        <div class="chipek" id="tTarca"></div>
        <div class="chipek" id="tNap"></div>
        <input class="mezo" id="tMegj" placeholder="Hol? Mire? (nem kötelező)" style="margin-top:8px" enterkeyhint="done">
        <div class="bill">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map(b => `<button type="button" class="nyom" data-b="${b}">${b === '⌫' ? ik('delete') : b}</button>`).join('')}</div>
        <button type="button" class="gomb fo nyom" id="tMent" style="margin-top:10px" disabled>Mentés</button>`);
    l.classList.add('tomor');
    const rajzTip = () => { l.querySelectorAll('[data-tip]').forEach(b => b.classList.toggle('on', b.dataset.tip === tip)); };
    const rajzKat = () => {
        const el = l.querySelector('#tKat');
        if(tip === 'atu'){ el.innerHTML = ''; return; }
        el.innerHTML = `<div class="katsor">${A.katSorrend(tip).map(k => { const sz = A.katSzin(tip, k.n);
            return `<button type="button" class="nyom${kat === k.n ? ' on' : ''}" data-k="${esc(k.n)}" style="background:var(--${sz});color:var(--${sz}-i)"><span class="ikd">${ik(PZ_IK[k.i] || 'tag')}</span>${esc(k.n)}</button>`; }).join('')}</div>`;
    };
    const rajzTarca = () => {
        const w = A.tarcak(), el = l.querySelector('#tTarca');
        if(!w.length){ el.innerHTML = ''; return; }
        const ikT = x => ik(x.tipus === 'keszpenz' ? 'banknote' : x.tipus === 'megtakaritas' ? 'piggy-bank' : x.tipus === 'kartya' ? 'credit-card' : 'landmark');
        const sor = (cim, akt, attr) => `<span class="chip" style="background:none;padding:0 4px;color:var(--muted)">${cim}</span>${w.map(x => `<button type="button" class="chip nyom${akt === x.id ? ' on' : ''}" ${attr}="${esc(x.id)}">${ikT(x)}${esc(x.n)}</button>`).join('')}`;
        el.innerHTML = tip === 'atu' ? sor('Honnan', tarca, 'data-w') + sor('Hová', tarca2, 'data-w2') : sor('Tárca', tarca, 'data-w');
    };
    const rajzNap = () => {
        const opc = [[maStr(), 'Ma'], [napPlusz(maStr(), -1), 'Tegnap'], [napPlusz(maStr(), -2), napSzo(napPlusz(maStr(), -2)).split(',')[0]]];
        l.querySelector('#tNap').innerHTML = opc.map(([s, n]) => `<button type="button" class="chip nyom${nap === s ? ' on' : ''}" data-nap="${s}">${ik('calendar')}${esc(n)}</button>`).join('')
            + `<label class="chip valaszto" style="position:relative">${ik('calendar')}Másik nap<input type="date" data-napv max="${maStr()}" style="position:absolute;inset:0;opacity:0"></label>`;
    };
    const info = () => {
        const el = l.querySelector('#tInfo');
        if(tip === 'ki' && kat){ const k = A.katOf('ki', kat); if(k && k.k){ const v = (A.hoTetelek(nap.slice(0, 7)) || []).filter(t => A.pzKi(t) && t.k === kat).reduce((s, t) => s + (t.o || 0), 0);
            el.textContent = `${kat}: ${k.k - v >= 0 ? 'még ' + ft(k.k - v) + ' Ft a keretből' : ft(v - k.k) + ' Ft-tal a keret felett'}`; return; } }
        if(tip === 'ki'){ const kr = A.keret(); el.textContent = kr.osszeg ? `Összesen még ${ft(kr.maradt)} Ft a havi keretből` : ''; return; }
        el.textContent = '';
    };
    const rajz = () => { const el = l.querySelector('#tOssz'); el.classList.toggle('ures', !osszeg); el.innerHTML = `${osszeg ? ft(+osszeg) : '0'}<small>Ft</small>`;
        l.querySelector('#tMent').disabled = !(+osszeg > 0 && (tip === 'atu' ? tarca && tarca2 && tarca !== tarca2 : kat)); };
    const minden = () => { rajzTip(); rajzKat(); rajzTarca(); rajzNap(); info(); rajz(); };
    minden();
    l.addEventListener('change', e => { if(e.target.matches('[data-napv]') && e.target.value){ nap = e.target.value; rajzNap(); info(); } });
    l.addEventListener('click', async e => {
        const b = e.target.closest('[data-b]');
        if(b){ rezeg(8); const v = b.dataset.b; if(v === '⌫') osszeg = osszeg.slice(0, -1); else if(osszeg.length < 10) osszeg = (osszeg + v).replace(/^0+/, ''); rajz(); return; }
        const t = e.target.closest('[data-tip]'); if(t){ tip = t.dataset.tip; kat = ''; minden(); return; }
        const k = e.target.closest('[data-k]'); if(k){ kat = k.dataset.k; rezeg(); rajzKat(); info(); rajz(); return; }
        const w = e.target.closest('[data-w]'); if(w){ tarca = tarca === w.dataset.w && tip !== 'atu' ? '' : w.dataset.w; rajzTarca(); rajz(); return; }
        const w2 = e.target.closest('[data-w2]'); if(w2){ tarca2 = w2.dataset.w2; rajzTarca(); rajz(); return; }
        const n = e.target.closest('[data-nap]'); if(n){ nap = n.dataset.nap; rajzNap(); info(); return; }
        if(e.target.closest('#tMent')){
            const o = +osszeg; if(!(o > 0)) return;
            const uj = { id: ujId('t'), t: tip, d: nap, ...(nap === maStr() ? { ido: idoStr() } : {}), k: tip === 'atu' ? '' : kat, a: '', m: l.querySelector('#tMegj').value.trim(), o,
                ...(tarca ? { p: tarca } : {}), ...(tip === 'atu' ? { p2: tarca2 } : {}) };
            if(tarca && tip !== 'atu') A.aktTarcaMent(tarca);
            zar(); rezeg(15);
            visszajelez(await A.muvelet('tetel', uj), `${tip === 'bev' ? '+' : tip === 'atu' ? '' : '−'}${ft(o)} Ft${uj.k ? ' · ' + uj.k : ''}`);
        }
    });
}

// ---------- tétel részletei ----------
export function tetelReszlet(t){
    const w = id => (A.tarcak().find(x => x.id === id) || {}).n;
    const tipSzo = t.t === 'bev' ? 'Bevétel' : t.t === 'atu' ? 'Átutalás' : 'Kiadás';
    const sz = t.t === 'atu' ? 'semleges' : A.katSzin(t.t === 'bev' ? 'bev' : 'ki', t.k);
    const kk = A.katOf(t.t === 'bev' ? 'bev' : 'ki', t.k);
    const sor = (c, v) => v ? `<div class="sor"><span class="n"><span>${c}</span><b>${esc(v)}</b></span></div>` : '';
    const { l, zar } = lap(t.m || t.k || tipSzo, `
        <div style="display:flex;align-items:center;gap:12px;margin:4px 0 8px"><span class="ikd" style="width:48px;height:48px;border-radius:16px;background:var(--${sz});color:var(--${sz}-i)">${ik(t.t === 'atu' ? 'arrow-left-right' : PZ_IK[kk && kk.i] || 'tag')}</span>
            <div><div class="szam" style="font-size:30px;font-weight:700;letter-spacing:-.8px;color:${t.t === 'bev' ? 'var(--ok)' : 'var(--ink)'}">${t.t === 'bev' ? '+' : t.t === 'atu' ? '' : '−'}${ft(t.o)} Ft</div><div style="color:var(--muted);font-size:13.5px">${tipSzo}</div></div></div>
        <div class="k lista">${sor('Kategória', [t.k, t.a].filter(Boolean).join(' › '))}${sor('Nap', napSzo(t.d) + (t.ido ? ' · ' + t.ido : ''))}${sor(t.t === 'atu' ? 'Honnan' : 'Tárca', w(t.p))}${sor('Hová', t.t === 'atu' ? w(t.p2) : '')}${sor('Megjegyzés', t.m)}${t.kh ? sor('Kimutatás', 'Kihagyva az összesítőkből') : ''}</div>
        <p style="font-size:12.5px;color:var(--muted);margin:10px 4px 0;line-height:1.5">Szerkeszteni egyelőre a teljes nézetben lehet (Több → Pénzügyek).</p>
        <button type="button" class="gomb mas vesz nyom" id="tTorol" style="width:100%;margin-top:14px">${ik('trash-2')}Tétel törlése</button>`, { zarSzo: 'Kész' });
    l.querySelector('#tTorol').addEventListener('click', async () => {
        if(!confirm('Biztosan törlöd ezt a tételt?')) return;
        zar(); visszajelez(await A.muvelet('torol', t), 'Tétel törölve');
    });
}
