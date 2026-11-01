// Sikerfüzet → Erfolgsjournal (Chrome-bővítmény, tartalom-szkript)
// Az Erfolgsjournal oldalán fut. A számokat a megnyitó Sikerfüzet-laptól kéri el (a Sikerfüzet Havi tervéből
// „Erfolgsjournal megnyitása” gombbal nyitott lap), különben a vágólapról (a megnyitás oda is kiteszi).
// - Havi terv oldal (…/month/ÉÉÉÉ/H): magától beírja a Célom pénzben / ES-ben értékeket és a Havi képletet.
// - Aktuális hét oldal (CÉL / VAN · Heti célok): a panelen választott hét Cél és Van számait egy kattintással.
// A mezőket a feliratuk alapján keresi (nem az oldal belső kódja alapján).
(() => {
  if (window.__sfejBetoltve) return; window.__sfejBetoltve = true;
  const M = ['Kontaktus', 'EL időpont', 'Elemzés', 'TA időpont', 'Tanácsadás', 'Lezárt ÜF', 'ES', 'Ajánlások'];
  const lat = e => !!(e && (e.offsetParent || e.getClientRects().length));
  const kis = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const felirat = (gyoker, szoveg) => [...gyoker.querySelectorAll('*')].filter(e => lat(e) && !e.closest('input,select,textarea,button,#sfejPanel') && [...e.childNodes].some(n => n.nodeType === 3 && kis(n.textContent) === kis(szoveg)));
  const mezok = (el, n) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const l = [...p.querySelectorAll('input')].filter(i => lat(i) && !['hidden', 'checkbox', 'radio'].includes(i.type) && !i.closest('#sfejPanel')); if (l.length >= n) return l.slice(0, n); } return []; };
  const kartya = cim => { const h = [...document.querySelectorAll('body *')].find(e => lat(e) && !e.closest('nav,aside,#sfejPanel') && [...e.childNodes].some(n => n.nodeType === 3 && kis(n.textContent).startsWith(kis(cim))));
    if (!h) return null; let p = h; for (let i = 0; i < 10 && p.parentElement; i++) { p = p.parentElement; if (p.querySelectorAll('input').length >= 8) return p; } return null; };
  const ir = (el, v) => { if (!el || v === '' || v == null) return 0;
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); el.focus(); d.set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); return 1; };

  // ---- adat: a megnyitó Sikerfüzettől, különben a vágólapról ----
  let adat = null;
  async function adatKer() {
    // 1) a Sikerfüzet által a címben átadott, a bővítmény tárhelyére mentett számok (24 órán belüli)
    try { const t = await chrome.storage.local.get(['sfejAdat', 'sfejIdo']);
      if (t && t.sfejAdat && Date.now() - (t.sfejIdo || 0) < 24 * 3600 * 1000) return t.sfejAdat; } catch (_) {}
    // 2) a megnyitó Sikerfüzet-lap, 3) a vágólap
    if (window.opener) {
      const a = await new Promise(ok => { const f = e => { if (e.data && e.data.sfej === 'adat') { removeEventListener('message', f); ok(e.data.adat); } };
        addEventListener('message', f); try { window.opener.postMessage({ sfej: 'kerem' }, '*'); } catch (_) {} setTimeout(() => { removeEventListener('message', f); ok(null); }, 1500); });
      if (a) return a;
    }
    try { const t = await navigator.clipboard.readText(); if (t && t.startsWith('SFEJ1:')) return JSON.parse(t.slice(6)); } catch (_) {}
    return null;
  }

  // ---- panel ----
  const panel = document.createElement('div'); panel.id = 'sfejPanel';
  panel.style.cssText = 'position:fixed;right:18px;top:16px;z-index:2147483647;width:270px;background:#0f2a52;color:#fff;font:500 13px/1.45 system-ui,-apple-system,sans-serif;padding:12px 14px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,.3)';
  const gomb = 'border:0;border-radius:9px;padding:7px 12px;font:700 13px system-ui,sans-serif;cursor:pointer';
  function rajz(allapot, extra) {
    panel.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:14px">Sikerfüzet</b><span style="margin-left:auto;cursor:pointer;opacity:.7" data-x title="Elrejtés">✕</span></div>
      <div data-all style="white-space:pre-line;opacity:.92">${allapot}</div>${extra || ''}`;
    panel.querySelector('[data-x]').onclick = () => { bezart = location.pathname; panel.remove(); };
    if (!panel.isConnected) document.body.appendChild(panel);
  }
  const hetOpciok = () => { const kwk = Object.values(adat.honapok || {}).flatMap(h => h.hetek || []).sort((a, b) => a.kw - b.kw);
    return kwk.map(h => `<option value="${h.kw}"${h.kw === adat.akt ? ' selected' : ''}>${h.kw}. hét${h.kw === adat.akt ? ' (most)' : ''}</option>`).join(''); };

  function honapKitolt(ev, ho) {
    const kulcs = `${ev}-${+ho}`, h = adat.honapok && adat.honapok[kulcs];
    if (!h) return { db: 0, uzi: `A ${ev}. ${ho}. hónaphoz nincs havi terv a Sikerfüzetben.` };
    let db = 0; const hiany = [];
    for (const [cim, v] of [['Célom pénzben', h.celPenz], ['Célom ES-ben', h.celES]]) { const f = felirat(document, cim)[0]; if (f) db += ir(mezok(f, 1)[0], v); else hiany.push(cim); }
    const kk = kartya('Havi képlet');
    if (kk) M.forEach((m, i) => { const f = felirat(kk, m)[0]; if (f) db += ir(mezok(f, 1)[0], h.formula[i]); else hiany.push(m); }); else hiany.push('Havi képlet');
    return { db, uzi: `${kulcs}: ${db} mező kitöltve ✓${hiany.length ? '\nNem találtam: ' + hiany.join(', ') : ''}\nNézd át, és véglegesítsd, ahogy eddig.` };
  }
  function hetKitolt(kw) {
    const het = Object.values(adat.honapok || {}).flatMap(h => h.hetek || []).find(x => x.kw === kw);
    if (!het) return `A ${kw}. héthez nincs adat a Sikerfüzetben.`;
    const card = kartya('CÉL / VAN'); if (!card) return 'Nem találom a „CÉL / VAN · Heti célok” részt.';
    let db = 0; const hiany = [];
    M.forEach((m, i) => { const f = felirat(card, m)[0]; if (!f) { hiany.push(m); return; } const [cel, van] = mezok(f, 2); db += ir(cel, het.cel[i]) + ir(van, het.van[i]); });
    const sz = felirat(card, 'Szerviz')[0]; if (sz) { const l = mezok(sz, 2); db += ir(l[1] || l[0], het.szv); }
    return `${kw}. hét: ${db} mező kitöltve ✓${hiany.length ? '\nNem találtam: ' + hiany.join(', ') : ''}`;
  }

  // ---- „Egész hónap kitöltése”: képlet + a hónap minden hetének Cél / Van száma ----
  // A feladat a bővítmény tárhelyén áll (sfejFeladat), így ha a hétre kattintás újratölti az oldalt, onnan folytatja.
  const var_ = ms => new Promise(r => setTimeout(r, ms));
  const varjRa = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await var_(250); } return null; };
  // a bal oldali hétlista eleme („45. hét 31.10 – 06.11”)
  const hetLink = kw => { const re = new RegExp('^' + kw + '\\.\\s*hét');
    const l = [...document.querySelectorAll('a,button,[role="button"],li,div')].filter(e => lat(e) && !e.closest('#sfejPanel') && re.test(kis(e.innerText)));
    // a legbelső találat (amiben nincs másik), abból a kattintható link / gomb
    const belso = l.find(e => !l.some(x => x !== e && e.contains(x))); if (!belso) return null;
    return belso.closest('a,button,[role="button"]') || belso.querySelector('a,button,[role="button"]') || belso; };
  let futFolyik = false;
  async function honapInditas(ev, ho) {
    const h = adat.honapok && adat.honapok[`${ev}-${+ho}`]; if (!h) return;
    await chrome.storage.local.set({ sfejFeladat: { ev, ho: +ho, hetek: h.hetek.map(x => x.kw), i: 0, vissza: location.pathname, db: 0, hiba: [] } });
    folytat();
  }
  async function folytat() {
    if (futFolyik) return; futFolyik = true;
    try {
      while (true) {
        const { sfejFeladat: f } = await chrome.storage.local.get('sfejFeladat'); if (!f) return;
        if (f.i >= f.hetek.length) {
          const vege = `Kész ✓ – ${f.ev}. ${f.ho}. hónap: ${f.hetek.length} hét, ${f.db} mező kitöltve.${f.hiba.length ? '\nNem sikerült: ' + f.hiba.join(', ') : ''}\nNézd át, és véglegesítsd, ahogy eddig.`;
          await chrome.storage.local.remove('sfejFeladat'); await chrome.storage.local.set({ sfejVege: vege });
          rajz(vege);
          if (location.pathname !== f.vissza) { const l = [...document.querySelectorAll('a')].find(a => a.getAttribute('href') && a.getAttribute('href').includes(f.vissza)); if (l) l.click(); else location.href = f.vissza; }
          return;
        }
        const kw = f.hetek[f.i];
        rajz(`Egész hónap kitöltése…\n${kw}. hét (${f.i + 1} / ${f.hetek.length})`, `<button data-stop style="${gomb};margin-top:8px;background:#fff;color:#0f2a52">Leállítás</button>`);
        panel.querySelector('[data-stop]').onclick = async () => { await chrome.storage.local.remove('sfejFeladat'); rajz('Leállítva.'); };
        let ok = false;
        // ha a hétre kattintás újratöltötte az oldalt, a tárolt „nav” mutatja, hogy már a jó héten állunk
        let ott = f.nav === kw;
        if (!ott) {
          const link = await varjRa(() => hetLink(kw), 8000);
          if (link) { f.nav = kw; await chrome.storage.local.set({ sfejFeladat: f });
            const elotte = location.href; link.click(); await varjRa(() => location.href !== elotte, 4000); await var_(600); ott = true; }
        }
        if (ott) {
          if (await varjRa(() => kartya('CÉL / VAN'), 10000)) {
            await var_(500);
            const uzi = hetKitolt(kw), m = uzi.match(/(\d+) mező/); f.db += m ? +m[1] : 0; ok = !!m;
            await var_(1800);   // az Erfolgsjournal automatikus mentésének ideje
          }
        }
        if (!ok) f.hiba.push(kw + '. hét');
        f.i++; f.nav = null; await chrome.storage.local.set({ sfejFeladat: f });
      }
    } finally { futFolyik = false; }
  }

  // ---- az oldal felismerése (az Erfolgsjournal egyoldalas app: a cím váltásakor újra) ----
  let utolso = '', kesz = new Set(), bezart = '';
  async function vizsgal() {
    if (futFolyik) return;
    try { const { sfejFeladat: f } = await chrome.storage.local.get('sfejFeladat'); if (f) { if (!adat) adat = await adatKer(); if (adat && kartya('CÉL / VAN') || adat && kartya('Havi képlet')) { folytat(); return; } } } catch (_) {}
    const hoM = location.pathname.match(/month\/(\d{4})\/(\d{1,2})/);
    const kulcs = location.pathname;
    const havi = hoM && kartya('Havi képlet'), heti = !havi && kartya('CÉL / VAN');
    if (!havi && !heti) { if (utolso !== kulcs) { utolso = kulcs; panel.remove(); } return; }
    if (bezart === kulcs || (utolso === kulcs && panel.isConnected)) return;
    utolso = kulcs;
    if (!adat) { rajz('Számok betöltése…'); adat = await adatKer(); }
    if (!adat) { rajz('Nincs átvehető adat.\nNyisd meg (újra) az Erfolgsjournalt a Sikerfüzet Havi tervéből az „Erfolgsjournal megnyitása” gombbal – a számokat az viszi át.',
        `<button data-ujra style="${gomb};margin-top:8px;background:#fff;color:#0f2a52">Újrapróbálom</button>`);
      panel.querySelector('[data-ujra]').onclick = async () => { adat = await adatKer(); utolso = ''; vizsgal(); }; return; }
    if (havi) {
      // a hónap a címben van → biztonságosan, magától (laponként egyszer)
      try { const { sfejVege } = await chrome.storage.local.get('sfejVege'); if (sfejVege) { await chrome.storage.local.remove('sfejVege'); kesz.add('ho:' + kulcs);
        rajz(sfejVege, `<button data-ujra style="${gomb};margin-top:8px;background:#fff;color:#0f2a52">Csak a képlet újra</button>`);
        panel.querySelector('[data-ujra]').onclick = () => { const r = honapKitolt(hoM[1], hoM[2]); panel.querySelector('[data-all]').textContent = r.uzi; }; return; } } catch (_) {}
      const k = 'ho:' + kulcs;
      const eredm = kesz.has(k) ? null : honapKitolt(hoM[1], hoM[2]); kesz.add(k);
      const hh = adat.honapok && adat.honapok[`${hoM[1]}-${+hoM[2]}`], n = hh ? hh.hetek.length : 0;
      rajz((eredm ? eredm.uzi : 'A havi célok és a képlet ki vannak töltve.') + (n ? `\n\nA hetek Cél / Van számai: „Egész hónap kitöltése” (${n} hét, sorban végigmegy rajtuk).` : ''),
        `${n ? `<button data-honap style="${gomb};margin-top:8px;width:100%;background:#22c55e;color:#06260f">Egész hónap kitöltése (${n} hét)</button>` : ''}
         <button data-ujra style="${gomb};margin-top:6px;background:#fff;color:#0f2a52">Csak a képlet újra</button>`);
      panel.querySelector('[data-ujra]').onclick = () => { const r = honapKitolt(hoM[1], hoM[2]); panel.querySelector('[data-all]').textContent = r.uzi; };
      const hb = panel.querySelector('[data-honap]'); if (hb) hb.onclick = () => { honapKitolt(hoM[1], hoM[2]); honapInditas(hoM[1], hoM[2]); };
    } else {
      // heti oldal: a hetet a felhasználó erősíti meg (nehogy rossz hétre kerüljön)
      rajz('Melyik hét számait írjam be (Cél és Van)?',
        `<div style="display:flex;gap:6px;margin-top:8px"><select data-het style="flex:1;border-radius:9px;border:0;padding:6px 8px;font:600 13px system-ui,sans-serif">${hetOpciok()}</select>
         <button data-kit style="${gomb};background:#22c55e;color:#06260f">Kitöltés</button></div>`);
      panel.querySelector('[data-kit]').onclick = () => { const kw = +panel.querySelector('[data-het]').value; panel.querySelector('[data-all]').textContent = hetKitolt(kw); };
    }
  }
  // az app tartalma késve rajzolódik ki, és lapváltáskor cserélődik – figyeljük
  setInterval(vizsgal, 1000); vizsgal();
})();
