// Közös felület-elemek: formázás, dátum, toast, felcsúszó lap, illusztrációk.
import { ik } from './ikonok.js';
import { rezeg } from './platform.js';

export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const ft = n => Math.round(n || 0).toLocaleString('hu-HU').replace(/ /g, ' ');
const pad = n => String(n).padStart(2, '0');
export const napStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const maStr = () => napStr(new Date());
export const hoStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const hoLep = (ho, n) => { const [y, m] = ho.split('-').map(Number); return hoStr(new Date(y, m - 1 + n, 1)); };
export const napPlusz = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return napStr(d); };
export const napIdx = s => (new Date(s + 'T12:00').getDay() + 6) % 7;   // hétfő = 0
export const idoStr = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const ujId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const HO = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'];
export const HO_R = ['jan.','febr.','márc.','ápr.','máj.','jún.','júl.','aug.','szept.','okt.','nov.','dec.'];
export const NAP = ['hétfő','kedd','szerda','csütörtök','péntek','szombat','vasárnap'];
export const NAP_R = ['H','K','Sze','Cs','P','Szo','V'];
export const hoNev = ho => { const [y, m] = ho.split('-').map(Number); return `${y === new Date().getFullYear() ? '' : y + '. '}${HO[m - 1]}`; };
export function napSzo(s){
    if(s === maStr()) return 'Ma';
    if(s === napPlusz(maStr(), -1)) return 'Tegnap';
    const d = new Date(s + 'T12:00'); return `${HO_R[d.getMonth()]} ${d.getDate()}., ${NAP[napIdx(s)]}`;
}

// ---- toast ----
let toastT;
export function toast(szoveg, ikon = 'check', szin){
    let el = $('#toast');
    if(!el){ el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<i style="${szin ? 'background:' + szin : ''}">${ik(ikon)}</i>${esc(szoveg)}`;
    requestAnimationFrame(() => el.classList.add('on'));
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2400);
}

// ---- felcsúszó lap (bottom sheet) ----
export function lap(cim, html, { zarSzo = 'Mégse', onZar } = {}){
    const h = document.createElement('div'); h.className = 'hatter';
    const l = document.createElement('div'); l.className = 'lap'; l.setAttribute('role', 'dialog'); l.setAttribute('aria-modal', 'true');
    l.innerHTML = `<div class="fogo"></div><div class="lfej"><h2>${esc(cim)}</h2><button type="button" data-zar>${esc(zarSzo)}</button></div><div class="ltart">${html}</div>`;
    document.body.append(h, l);
    requestAnimationFrame(() => { h.classList.add('on'); l.classList.add('on'); });
    let zarva = false;
    const zar = () => { if(zarva) return; zarva = true; h.classList.remove('on'); l.classList.remove('on'); l.style.transform = '';
        setTimeout(() => { h.remove(); l.remove(); }, 320); onZar && onZar(); };
    h.addEventListener('click', zar); l.querySelector('[data-zar]').addEventListener('click', zar);
    // lehúzással bezárható (a fogantyúnál / fejlécnél fogva)
    let y0 = null, dy = 0;
    [l.querySelector('.fogo'), l.querySelector('.lfej')].forEach(f => f.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; l.style.transition = 'none'; }, { passive:true }));
    l.addEventListener('touchmove', e => { if(y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); l.style.transform = `translateY(${dy}px)`; }, { passive:true });
    l.addEventListener('touchend', () => { if(y0 == null) return; l.style.transition = ''; if(dy > 110) zar(); else l.style.transform = ''; y0 = null; dy = 0; });
    const esc_ = e => { if(e.key === 'Escape'){ zar(); document.removeEventListener('keydown', esc_); } };
    document.addEventListener('keydown', esc_);
    return { l, zar };
}

// ---- illusztrációk (saját, leveles–lapos stílus) ----
const ILL = {
    csira:`<ellipse cx="50" cy="86" rx="30" ry="6" fill="var(--g)"/><path d="M50 86V55" stroke="var(--a)" stroke-width="4" stroke-linecap="round"/><path d="M50 60C50 42 38 32 20 32c0 18 12 28 30 28z" fill="var(--a)"/><path d="M50 56c0-16 11-25 28-25 0 16-11 25-28 25z" fill="var(--b)"/>`,
    nap:`<circle cx="50" cy="58" r="22" fill="var(--c)"/><path d="M50 22v8M24 34l6 6M76 34l-6 6M14 58h8M78 58h8" stroke="var(--c)" stroke-width="4" stroke-linecap="round"/><path d="M10 80c12-8 22-8 34 0s22 8 34 0 14-6 14-6V92H10z" fill="var(--b)"/><path d="M10 86c14-6 26-6 40 0s26 6 40 0V92H10z" fill="var(--a)"/>`,
    hold:`<circle cx="22" cy="24" r="2" fill="var(--c)"/><circle cx="80" cy="20" r="1.6" fill="var(--c)"/><circle cx="72" cy="40" r="1.4" fill="var(--c)"/><path d="M66 66A28 28 0 1 1 40 26a22 22 0 0 0 26 40z" fill="var(--d)"/><path d="M10 88c18-10 34-10 46-4s22 6 34 0V96H10z" fill="var(--a)"/>`,
    lang:`<path d="M50 90c15 0 25-10 25-24 0-15-12-22-17-38-6 9-8 15-9 21-4-3-6-7-6-12C34 44 25 54 25 66c0 14 10 24 25 24z" fill="var(--c)"/><path d="M50 90c8 0 13-6 13-13 0-8-6-12-9-20-4 6-5 9-6 13-3-2-4-4-4-6-4 4-7 8-7 13 0 7 5 13 13 13z" fill="#fdeab5"/>`,
    kupa:`<path d="M34 22h32v18a16 16 0 0 1-32 0z" fill="#f2b552"/><path d="M34 28H24c0 10 6 15 12 15M66 28h10c0 10-6 15-12 15" stroke="#f2b552" stroke-width="4" fill="none"/><rect x="45" y="56" width="10" height="14" fill="var(--a)"/><rect x="34" y="70" width="32" height="10" rx="3" fill="var(--a)"/><path d="M58 18c8 0 14-6 14-14-8 0-14 6-14 14z" fill="var(--b)"/>`,
    persely:`<ellipse cx="50" cy="88" rx="30" ry="5" fill="var(--g)"/><ellipse cx="50" cy="60" rx="30" ry="24" fill="#b9d8c3"/><circle cx="40" cy="55" r="3" fill="#1f5c4a"/><rect x="42" y="38" width="16" height="4" rx="2" fill="#1f5c4a"/><path d="M78 56l8-4v12l-8-2z" fill="#b9d8c3"/><circle cx="50" cy="22" r="9" fill="var(--c)"/><path d="M28 80v8M70 80v8" stroke="#b9d8c3" stroke-width="6" stroke-linecap="round"/>`,
    ures_lap:`<rect x="26" y="16" width="48" height="66" rx="8" fill="#fff" stroke="#ebe6d8" stroke-width="3"/><path d="M36 34h28M36 44h22M36 54h26" stroke="#d6d0bf" stroke-width="4" stroke-linecap="round"/><path d="M58 82c0-14 8-22 20-22 0 12-8 22-20 22z" fill="var(--a)"/><path d="M58 82c-2-10-8-16-18-16 0 10 8 16 18 16z" fill="var(--b)"/>`,
};
export const ill = (k, cls = 'ill') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true" style="--a:#4f8f6f;--b:#b9d8c3;--c:#f2b552;--d:#fdeab5;--g:#ece6d6">${ILL[k] || ''}</svg>`;

// ---- haladás-gyűrű ----
export function gyuru(arany, szin, hatter, meret = 44, szoveg){
    const p = Math.max(0, Math.min(1, arany || 0));
    return `<div class="gyuru" style="width:${meret}px;height:${meret}px"><svg viewBox="0 0 36 36" width="${meret}" height="${meret}"><circle cx="18" cy="18" r="15" fill="none" stroke="${hatter}" stroke-width="4.5"/>
        <circle cx="18" cy="18" r="15" fill="none" stroke="${szin}" stroke-width="4.5" stroke-dasharray="94.25" stroke-dashoffset="${(94.25 * (1 - p)).toFixed(2)}" stroke-linecap="round"/></svg><b>${szoveg != null ? szoveg : Math.round(p * 100) + '%'}</b></div>`;
}

// gomb-visszajelzés: a pipa „megugrik”
export function pop(el){ if(!el) return; el.classList.add('pop'); rezeg(12); setTimeout(() => el.classList.remove('pop'), 180); }
