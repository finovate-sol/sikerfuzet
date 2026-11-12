// Ma: köszönés, napló-sorozat, havi keret, mai napló a heti napcsíkkal, gyors műveletek, mai szokások.
import { ik, SZ_IK } from '../ikonok.js';
import { esc, ft, ill, maStr, napPlusz, napIdx, NAP, NAP_R, HO, toast, pop } from '../ui.js';
import * as A from '../adat.js';
import { naploLap, tetelLap } from '../lapok.js';

export const cim = 'Ma';
export function rajz(el, { nev = '', offline = false } = {}){
    const most = new Date(), o = most.getHours();
    const koszon = (o < 5 ? 'Jó éjszakát' : o < 10 ? 'Jó reggelt' : o < 18 ? 'Szia' : 'Jó estét') + (nev ? ',<br>' + esc(nev) : '');
    const sor = A.naploSorozat(), kr = A.keret();
    const mai = A.napBej(maStr()), utolso = mai[mai.length - 1];
    // a hét napjai (hétfőtől)
    const het = []; const h0 = napPlusz(maStr(), -napIdx(maStr()));
    for(let i = 0; i < 7; i++){ const s = napPlusz(h0, i), b = A.napBej(s), h = b.length ? (b[b.length - 1].h || 0) : 0;
        het.push(`<div class="${s === maStr() ? 'ma' : ''}"><i class="${b.length ? 'van' : ''}">${b.length ? ik(A.HANG_IK[h] || 'check') : ''}</i>${NAP_R[i]}</div>`); }
    const keretP = kr.osszeg ? Math.min(100, Math.round(kr.kolt / kr.osszeg * 100)) : 0;
    const szok = A.szMai();
    el.innerHTML = `<div class="belso">
        <div class="fej"><div><div class="d">${NAP[napIdx(maStr())]} · ${HO[most.getMonth()]} ${most.getDate()}.</div><h1>${koszon}</h1></div>${ill(o >= 6 && o < 18 ? 'nap' : 'hold')}</div>
        ${offline ? `<div class="offline">${ik('wifi-off')}Nincs net – amit rögzítesz, feltöltöm, amint lesz.</div>` : ''}
        <div class="bento">
            <button type="button" class="csempe nyom" data-uj="naplo" style="background:var(--naplo);color:var(--naplo-i)"><span class="dek">${ik('flame')}</span>
                <span class="c">Napló-sorozat</span><span class="v szam">${sor.n}<small>nap</small></span><span class="s">${sor.maKesz ? 'A mai is megvan ✓' : sor.n ? 'Írj ma is, hogy folytatódjon' : 'Kezdd el ma!'}</span></button>
            <a class="csempe hos nyom" href="#penz"><span class="dek">${ik('piggy-bank')}</span>
                ${kr.osszeg ? `<span class="c">Maradt a havi keretből</span><span class="v szam" style="font-size:${Math.abs(kr.maradt) >= 1e6 ? 25 : 29}px">${ft(Math.max(0, kr.maradt))}<small>Ft</small></span>
                <div class="sav${keretP >= 100 ? ' tul' : keretP >= 85 ? ' figy' : ''}"><i style="width:${keretP}%"></i></div><span class="s">${kr.maradt >= 0 ? `≈ ${ft(kr.maradt / Math.max(1, kr.hatra))} Ft / nap` : `${ft(-kr.maradt)} Ft-tal túllépve`}</span>`
                : `<span class="c">Elköltve ebben a hónapban</span><span class="v szam" style="font-size:29px">${ft(A.honapOssz(maStr().slice(0, 7)).ki)}<small>Ft</small></span><span class="s">Havi keretet a Pénz fülön látsz, ha beállítod</span>`}</a>
        </div>
        <div class="szak">Ez a hét</div>
        <div class="k"><button type="button" class="mai nyom" data-uj="naplo" style="width:100%;text-align:left">${utolso ? `<span class="ikd" style="width:56px;height:56px;border-radius:18px;background:var(--naplo);color:var(--naplo-i)">${ik(A.HANG_IK[utolso.h] || 'notebook-pen')}</span><div><b>Ma: ${esc(A.hangSzo(utolso.h) || 'bejegyzés')}</b><span>${mai.length} bejegyzés · utoljára ${esc(utolso.ido || '')} · koppints egy újhoz</span></div>`
                : `${ill('csira')}<div><b>Ma még nem írtál</b><span>Egy koppintás a hangulat, egy a mentés.</span></div>`}</button>
            <div class="het">${het.join('')}</div></div>
        <div class="bento" style="margin-top:10px">
            <button type="button" class="csempe kicsi nyom" data-uj="naplo" style="background:#fff;border:1px solid var(--line);flex-direction:row;align-items:center;gap:10px"><span class="ikd" style="background:var(--naplo);color:var(--naplo-i)">${ik('notebook-pen')}</span><b style="font-size:15.5px">Napló</b></button>
            <button type="button" class="csempe kicsi nyom" data-uj="tetel" style="background:#fff;border:1px solid var(--line);flex-direction:row;align-items:center;gap:10px"><span class="ikd" style="background:var(--penz);color:var(--penz-i)">${ik('wallet')}</span><b style="font-size:15.5px">Költés</b></button>
        </div>
        <div class="szak">Mai szokások<a href="../index.html?app=elet&lap=szokasok">Mind</a></div>
        ${szok.length ? `<div class="k lista">${szok.map(h => { const sz = A.TER_SZIN[h.ter] || 'cel', on = A.szKesz(h, maStr());
            return `<button type="button" class="sor" data-szok="${esc(h.id)}"><span class="ikd" style="background:var(--${sz});color:var(--${sz}-i)">${ik(SZ_IK[h.ik] || 'check')}</span>
                <span class="n"><b>${esc(h.n)}</b><span>${esc(A.szAlszo(h))}</span></span><span class="pipa${on ? ' on' : ''}">${ik('check')}</span></button>`; }).join('')}</div>`
            : `<div class="k"><div class="ures" style="padding:4px">${ill('csira')}<b>Ma nincs esedékes szokás</b><span>Szokást a teljes nézetben vehetsz fel – utána itt pipálhatod.</span></div></div>`}
    </div>`;
}
export function esemeny(e){
    const u = e.target.closest('[data-uj]');
    if(u){ e.preventDefault(); u.dataset.uj === 'naplo' ? naploLap() : tetelLap('ki'); return true; }
    const sz = e.target.closest('[data-szok]');
    if(sz){
        const h = A.szAktiv().find(x => x.id === sz.dataset.szok); if(!h) return true;
        const on = !A.szKesz(h, maStr());
        pop(sz.querySelector('.pipa'));
        A.muvelet('szokas', { id: h.id, nap: maStr(), on }).then(r => { if(r === 'sorban') toast('Elmentve – feltöltöm, amint lesz net', 'wifi-off', 'var(--warn)'); else if(r === 'hiba') toast('Nem sikerült menteni', 'x', 'var(--err)'); else if(on){ const n = A.szSorozat(h); if(n > 1) toast(`${h.n} · ${n} napos sorozat`, 'flame', 'var(--warn)'); } });
        return true;
    }
    return false;
}
