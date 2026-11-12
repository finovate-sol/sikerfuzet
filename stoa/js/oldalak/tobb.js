// Több: a még át nem költöztetett részek (a teljes nézetben nyílnak), telepítés, fiók.
import { ik } from '../ikonok.js';
import { esc } from '../ui.js';
import { telepitett } from '../platform.js';
import * as A from '../adat.js';

export const cim = 'Több';
const RES = lap => `../index.html?app=elet&lap=${lap}`;
const MODUL = [
    ['enaplo', 'notebook-pen', 'naplo', 'Napló', 'bejegyzések, statisztika, naptár'],
    ['szokasok', 'circle-check', 'szokas', 'Szokások', 'szokások felvétele, jelvények'],
    ['celok', 'target', 'cel', 'Célok', 'vízió, célok, életkerék'],
    ['edzes', 'flame', 'egeszseg', 'Edzés', 'edzésterv, Strava'],
    ['egeszseg', 'heart', 'kapcs', 'Egészség', 'alvás, víz, súly'],
    ['penzugyek', 'wallet', 'penz', 'Pénzügyek – teljes', 'tervező, vagyon, hitel, előfizetések'],
    ['konyvek', 'sparkles', 'fejl', 'Olvasás', 'könyvek, olvasási lista'],
    ['jegyzetek', 'pencil', 'otthon', 'Jegyzetek', 'privát jegyzetek'],
    ['emberek', 'calendar', 'kapcs', 'Események', 'születésnapok, programok'],
    ['kiszemelt', 'heart', 'naplo', 'Kiszemeltek', 'amit szeretnél megvenni'],
    ['mentesek', 'external-link', 'szokas', 'Mentések', 'cikkek, linkek'],
    ['onismeret', 'smile', 'cel', 'Önismeret', 'tesztek, életkerék'],
];
export function rajz(el, { user, admin } = {}){
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    el.innerHTML = `<div class="belso">
        <div class="fej"><div><div class="d">Stoa</div><h1>Több</h1></div></div>
        <div class="szak">A Stoa többi része</div>
        <p style="font-size:13px;color:var(--muted);margin:-2px 4px 10px;line-height:1.5">Ezek még a teljes nézetben nyílnak meg – sorban költöznek át ide is.</p>
        <div class="k lista">${MODUL.map(([lap, i, sz, n, s]) => `<a class="sor nyom" href="${RES(lap)}"><span class="ikd" style="background:var(--${sz});color:var(--${sz}-i)">${ik(i)}</span><span class="n"><b>${esc(n)}</b><span>${esc(s)}</span></span>${ik('chevron-right', 'halk')}</a>`).join('')}</div>
        ${!telepitett() ? `<div class="szak">Telepítés</div><div class="k"><div class="sor" style="padding:4px 0"><span class="ikd" style="background:var(--erdo);color:var(--erdo-i)">${ik('smartphone')}</span><span class="n" style="white-space:normal"><b>Tedd ki a kezdőképernyőre</b><span style="white-space:normal">${iOS ? 'Safari → Megosztás → „Főképernyőhöz adás”. Saját ikonnal, teljes képernyőn indul.' : 'A böngésző menüjében: „Alkalmazás telepítése” / „Hozzáadás a kezdőképernyőhöz”.'}</span></span></div></div>` : ''}
        <div class="szak">Fiók</div>
        <div class="k lista">
            <div class="sor"><span class="ikd" style="background:var(--soft);color:var(--ink2)">${ik('house')}</span><span class="n"><b>${esc((user && (user.displayName || user.email)) || '')}</b><span>${esc((user && user.email) || '')}</span></span></div>
            ${admin ? `<a class="sor nyom" href="../index.html?app=elet"><span class="ikd" style="background:var(--erdo);color:var(--erdo-i)">${ik('lock')}</span><span class="n"><b>Ki használhatja a Stoát?</b><span>A teljes nézet menüjében: „Stoa hozzáférés”</span></span>${ik('chevron-right')}</a>` : ''}
            <a class="sor nyom" href="../index.html?app=siker"><span class="ikd" style="background:var(--szokas);color:var(--szokas-i)">${ik('external-link')}</span><span class="n"><b>Sikerfüzet megnyitása</b><span>a munkás rész</span></span>${ik('chevron-right')}</a>
            <button type="button" class="sor nyom" data-frissit><span class="ikd" style="background:var(--soft);color:var(--ink2)">${ik('refresh-cw')}</span><span class="n"><b>Frissítés</b><span>${A.kimenoDb() ? A.kimenoDb() + ' feltöltésre váró tétel' : 'adatok újratöltése'}</span></span></button>
            <button type="button" class="sor nyom" data-kilep><span class="ikd" style="background:var(--err-t);color:var(--err)">${ik('log-out')}</span><span class="n"><b>Kijelentkezés</b></span></button>
        </div>
        <p style="text-align:center;color:var(--muted);font-size:12px;margin-top:22px">Stoa · béta</p>
    </div>`;
}
