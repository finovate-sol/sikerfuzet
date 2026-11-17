// Sikerfüzet → Erfolgsjournal (Chrome-bővítmény, tartalom-szkript)
// Az Erfolgsjournal oldalán fut. A számokat a megnyitó Sikerfüzet-laptól kéri el (a Sikerfüzet Havi tervéből
// „Erfolgsjournal megnyitása” gombbal nyitott lap), különben a vágólapról (a megnyitás oda is kiteszi).
// - Havi terv oldal (…/month/ÉÉÉÉ/H): magától beírja a Célom pénzben / ES-ben értékeket és a Havi képletet.
// - Aktuális hét oldal (CÉL / VAN · Heti célok): a panelen választott hét Cél és Van számait egy kattintással.
// - Heti tervezés naptár: a Sikerfüzet összes időpontját (ügyfél, PG, Tréning, Telefonparti, Interjú, MAG-nap…, a többi „Egyéb”-ként)
//   az „Új időpont” ablakon át beírja (egyszer), a hellyel és a jegyzettel; a megvalósulást (Állapot) beírja / frissíti.
// - Visszamenőleg: ha a Sikerfüzet több hónapot ad át (sor), a legrégebbitől hónapról hónapra végigmegy rajtuk.
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
      if (t && t.sfejAdat && Date.now() - (t.sfejIdo || 0) < 45 * 24 * 3600 * 1000) return t.sfejAdat; } catch (_) {}
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

  // ---- 3-2-1 Kontaktusok: a hét Saját pénzem / Saját karrierem listája ----
  // A Journal táblájában előre kirakott sorok vannak („Név megadása…”), a sorban Jegyzetek, Típus (lenyíló) és Eredmény.
  // Akit már beírtak (azonos név), azt nem írjuk be újra – csak a hiányzó jegyzetet / típust / eredményt pótoljuk.
  const nevNorm = s => kis(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nevMezok = card => [...card.querySelectorAll('input,textarea')].filter(i => lat(i) && /név megad/i.test(i.placeholder || ''));
  const sorElem = inp => { for (let p = inp.parentElement; p && p.parentElement; p = p.parentElement) { if (p.tagName === 'TR') return p;
      if ([...p.querySelectorAll('input,textarea')].filter(i => /név megad/i.test(i.placeholder || '')).length > 1) return null;
      if (p.querySelector('select')) return p; } return null; };
  const TIP_ROKON = { 'elemzés': ['elemzés', 'el '], 'tanácsadás': ['tanácsadás', 'ta '], 'szerviz': ['szerviz', 'sz '], 'felvételi 1': ['felvételi 1', 'interjú 1', 'f1', 'interjú', 'felvételi'], 'felvételi 2': ['felvételi 2', 'interjú 2', 'f2', 'tob', 'info'] };
  const selIr = (sel, szoveg) => { if (!sel || !szoveg) return 0; const rok = TIP_ROKON[kis(szoveg)] || [kis(szoveg)];
    const op = [...sel.options].find(o => kis(o.text) === kis(szoveg)) || [...sel.options].find(o => rok.some(r => kis(o.text).startsWith(r))) || [...sel.options].find(o => kis(o.text).startsWith(kis(szoveg).slice(0, 4)));
    if (!op || sel.value === op.value) return op ? 1 : 0;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, op.value);
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); return 1; };
  const eredmAll = t => { const x = kis(t); if (/✕|✗|×|nem |nem$|nem sikerült|sikertelen|elutas|nem érte|nem vette/.test(x)) return 'no'; if (/✓|✔|lebesz|sikerült|igen|időpont|egyeztet|\bok\b/.test(x)) return 'ok'; return 'pending'; };
  const EREDM_RE = { ok: /✓|✔|lebesz|sikerült|igen|időpont|egyeztetve|\bok\b/i, no: /✕|✗|×|nem sikerült|sikertelen|nem érte|nem vette|elutas|^nem$/i };
  async function eredmIr(sor, e) {
    if (!e || e === 'pending') return 1;
    const sel = [...sor.querySelectorAll('select')].filter(lat)[1];
    if (sel) { const op = [...sel.options].find(o => EREDM_RE[e].test(o.text) && !(e === 'ok' && EREDM_RE.no.test(o.text)));
      if (op) { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, op.value); sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); return 1; } }
    const cellak = [...sor.children].filter(lat); const c = cellak.length >= 4 ? cellak[3] : cellak[cellak.length - 1]; if (!c) return 0;
    if (eredmAll(c.innerText) === e) return 1;
    for (let k = 0; k < 4; k++) {
      const elotte = new Set([...document.querySelectorAll('button,[role="option"],[role="menuitem"],[role="radio"],li,label')].filter(lat));
      const g = c.querySelector('button,[role="button"],select,input,span,div') || c; const r = g.getBoundingClientRect(); egerrel(r.left + r.width / 2, r.top + r.height / 2); await var_(350);
      // a cellában megjelent lenyíló
      const s2 = c.querySelector('select'); if (s2 && lat(s2)) { const op = [...s2.options].find(o => EREDM_RE[e].test(o.text) && !(e === 'ok' && EREDM_RE.no.test(o.text)));
        if (op) { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s2, op.value); s2.dispatchEvent(new Event('change', { bubbles: true })); return 1; } }
      // felugró menü / gombsor: az újonnan megjelent elemek közül a megfelelő felirat
      const uj = [...document.querySelectorAll('button,[role="option"],[role="menuitem"],[role="radio"],li,label')].filter(x => lat(x) && !elotte.has(x) && !x.closest('#sfejPanel'));
      const cel = uj.find(x => EREDM_RE[e].test(x.innerText || x.title || x.getAttribute('aria-label') || '') && !(e === 'ok' && EREDM_RE.no.test(x.innerText || '')));
      if (cel) { cel.click(); await var_(300); return 1; }
      if (uj.length) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      // kattintásra váltó jelvény
      if (eredmAll(c.innerText) === e) return 1;
    }
    return 0; }
  // választás egy sor lenyílójából: natív <select>, vagy egyedi lenyíló (gomb → felugró lista)
  async function listaValaszt(cella, szoveg, re) {
    if (!cella) return 0;
    const sel = [...cella.querySelectorAll('select')].find(lat); if (sel) return re ? 0 : selIr(sel, szoveg);
    const rok = re ? null : (TIP_ROKON[kis(szoveg)] || [kis(szoveg)]);
    const jo = t => { const x = kis(t); return re ? (re.test(t) && !(re === EREDM_RE.ok && EREDM_RE.no.test(t))) : (x === kis(szoveg) || rok.some(r => x.startsWith(r.trim()))); };
    if (jo(cella.innerText)) return 1;
    const elotte = new Set([...document.querySelectorAll('*')].filter(lat));
    const g = cella.querySelector('button,[role="combobox"],[role="button"],[aria-haspopup]') || cella.firstElementChild || cella; const r = g.getBoundingClientRect(); egerrel(r.left + r.width / 2, r.top + r.height / 2); await var_(350);
    const uj = [...document.querySelectorAll('[role="option"],[role="menuitem"],li,button,div,span')].filter(x => lat(x) && !elotte.has(x) && !x.closest('#sfejPanel') && x.children.length <= 1 && (x.innerText || '').trim());
    const cel = uj.find(x => jo(x.innerText)); if (cel) { cel.click(); await var_(300); return 1; }
    if (uj.length) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await var_(200); }
    return 0; }
  // szöveg egy cellába: ha van benne mező, oda; ha nincs, rákattintunk (szerkeszthetővé válik), és a megjelenő mezőbe
  async function cellaSzoveg(cella, v) {
    if (!cella || !v) return 0;
    const mezo = () => [...cella.querySelectorAll('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable="true"]')].find(lat);
    let m = mezo();
    if (!m) { const elotte = new Set([...document.querySelectorAll('input,textarea,[contenteditable="true"]')]);
      const r = cella.getBoundingClientRect(); egerrel(r.left + Math.min(30, r.width / 2), r.top + r.height / 2); await var_(300);
      m = mezo() || [...document.querySelectorAll('input:not([type=checkbox]),textarea,[contenteditable="true"]')].find(x => lat(x) && !elotte.has(x) && !x.closest('#sfejPanel')); }
    if (!m) return 0;
    if (kis(m.value || m.innerText) === kis(v)) return 1;
    if (m.isContentEditable) { m.focus(); document.execCommand('selectAll', false); document.execCommand('insertText', false, v); }
    else if (String(m.value || '').trim()) return 1;   // amit már beírtak, nem írjuk felül
    else szovegIr(m, v);
    m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); m.blur(); await var_(250);
    return 1; }
  async function h321Lista(cim, lista) {
    const card = kartya(cim); if (!card) return { db: 0, hiba: [`nem találom: ${cim}`] };
    let db = 0; const hiba = [];
    for (const x of lista) {
      let mezok = nevMezok(card);
      let inp = mezok.find(i => nevNorm(i.value) === nevNorm(x.n)), uj = false;
      if (!inp) { inp = mezok.find(i => !String(i.value || '').trim()); if (!inp) { hiba.push(`${x.n} (nincs több üres sor)`); continue; }
        szovegIr(inp, x.n); uj = true; await var_(350);
        inp = nevMezok(card).find(i => nevNorm(i.value) === nevNorm(x.n)) || inp; }
      const sor = sorElem(inp); if (!sor) { if (uj) db++; continue; }
      const jg = [...sor.querySelectorAll('input,textarea')].filter(i => lat(i) && i !== inp && !/név megad/i.test(i.placeholder || '') && !['checkbox', 'radio'].includes(i.type))[0];
      // a jegyzet a telefonszám; a korábbi bővítmény „mire · telefon · jegyzet” formájú bejegyzését is kicseréljük
      if (jg && x.j && (!String(jg.value || '').trim() || (/ · /.test(jg.value) && kis(jg.value) !== kis(x.j)))) szovegIr(jg, x.j);
      const cellak = [...sor.children].filter(lat);
      if (x.t && !(await listaValaszt(cellak[2], x.t))) hiba.push(`${x.n} (típus: ${x.t})`);
      await var_(250);
      // Eredmény = a Sikerfüzetben írt jegyzet (szöveg); ha üres, a ✓ / ✕ jelölés
      if (x.er) { if (!(await cellaSzoveg(cellak[3], x.er))) hiba.push(`${x.n} (eredmény)`); }
      else if (x.e && x.e !== 'pending') { const ok = (await listaValaszt(cellak[3], '', EREDM_RE[x.e])) || (await eredmIr(sor, x.e)); if (!ok) hiba.push(`${x.n} (eredmény)`); }
      if (uj) db++;
      await var_(200);
    }
    return { db, hiba };
  }
  async function h321Kitolt(kw) {
    const het = Object.values(adat.honapok || {}).flatMap(h => h.hetek || []).find(x => x.kw === kw);
    const h = het && het.h321; if (!h || (!(h.penz || []).length && !(h.karr || []).length)) return { db: 0, hiba: [], nincs: true };
    const ful = gombSzoveg(document, '3-2-1 Kontaktusok')[0] || felirat(document, '3-2-1 Kontaktusok')[0]; if (ful) { ful.click(); await var_(700); }
    if (!(await varjRa(() => kartya('3-2-1 · Saját pénzem') || kartya('3-2-1 · Saját karrierem'), 6000))) return { db: 0, hiba: ['a 3-2-1 táblák nem találhatók'] };
    const a = (h.penz || []).length ? await h321Lista('3-2-1 · Saját pénzem', h.penz) : { db: 0, hiba: [] };
    const b = (h.karr || []).length ? await h321Lista('3-2-1 · Saját karrierem', h.karr) : { db: 0, hiba: [] };
    await var_(1500);   // a Journal automatikus mentése
    return { db: a.db + b.db, hiba: [...a.hiba, ...b.hiba] };
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
  // ---- OVB-időpontok a „Heti tervezés” naptárba (Új időpont ablak) ----
  const HO_ROV = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
  const gombSzoveg = (gy, t) => [...gy.querySelectorAll('button,[role="button"],a')].filter(e => lat(e) && !e.closest('#sfejPanel') && kis(e.innerText) === kis(t));
  // a heti naptár oszlopai: a fejléc „11. 14., Szo” cellái → { md: '11-14', el }
  const napOszlopok = () => { const l = [];
    for (const e of document.querySelectorAll('th,[role="columnheader"],div,span')) {
      if (!lat(e) || e.closest('#sfejPanel') || e.children.length > 2) continue;
      const m = kis(e.innerText).match(/^(\d{1,2})\.\s*(\d{1,2})\.,?\s*(h|k|sze|cs|p|szo|v)$/);
      if (m) { const md = `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; if (!l.some(x => x.md === md)) l.push({ md, el: e }); } }
    return l; };
  // a bal oldali óra-felirat („8”) a naptár rácsában
  const oraCimke = (h, balSzel) => [...document.querySelectorAll('td,th,div,span')].filter(e => lat(e) && e.children.length === 0 && kis(e.innerText) === String(h) && e.getBoundingClientRect().right <= balSzel + 4)
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).pop();
  const egerrel = (x, y) => { const t = document.elementFromPoint(x, y); if (!t) return false;
    const o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window };
    t.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerId: 1, isPrimary: true })); t.dispatchEvent(new MouseEvent('mousedown', o));
    t.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0, pointerId: 1, isPrimary: true })); t.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0 })); return true; };
  // az időpont-ablak (új vagy szerkesztés): a Mentés gomb legközelebbi őse, amiben a „Cím…” mező is benne van
  const ablak = () => { const m = gombSzoveg(document, 'Mentés')[0]; if (!m) return null;
    for (let p = m.parentElement; p && p !== document.body; p = p.parentElement)
      if ([...p.querySelectorAll('input')].some(i => lat(i) && /^cím/i.test(i.placeholder || ''))) return p;
    return null; };
  // Állapot: a Sikerfüzet Megtörtént / Elmaradt / Még nincs jelölése → az Erfolgsjournal Állapot mezője
  const ALLAPOT = { yes: 'Megtörtént', no: 'Lemondva', '': 'Nyitott' };
  const allKod = a => 'a:' + (a || 'n');
  const allapotIr = (ab, all) => {
    const cel = ALLAPOT[all || ''] || 'Nyitott';
    const f = felirat(ab, 'Állapot')[0]; let sel = null;
    if (f) for (let p = f.parentElement; p && p !== ab.parentElement && !sel; p = p.parentElement) sel = [...p.querySelectorAll('select')].find(lat) || null;
    if (!sel) sel = [...ab.querySelectorAll('select')].find(x => lat(x) && [...x.options].some(o => kis(o.text) === kis('Megtörtént')));
    if (!sel) return false;
    const op = [...sel.options].find(o => kis(o.text) === kis(cel)); if (!op) return false;
    if (sel.value === op.value) return true;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, op.value);
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true; };
  // az „Időpont típusa” csempéi közül a megadott kiválasztása (gomb, címke, div – amelyik épp)
  async function tipusValaszt(ab, tip) {
    if (!tip) return true;
    const jel = [...ab.querySelectorAll('button,[role="button"],[role="radio"],label,a,div,span,li')].filter(x => lat(x) && !x.closest('#sfejPanel,input,select,textarea') && kis(x.innerText) === kis(tip));
    if (!jel.length) return false;
    // a legkülső ilyen elem a csempe (a belső span csak a felirat)
    const cs = jel.find(x => !jel.some(y => y !== x && y.contains(x))) || jel[0];
    const kat = cs.closest('button,[role="button"],[role="radio"],label,a') || cs;
    const r = kat.getBoundingClientRect(); egerrel(r.left + r.width / 2, r.top + r.height / 2); await var_(200);
    const radio = kat.querySelector('input[type="radio"]') || (kat.htmlFor && document.getElementById(kat.htmlFor));
    if (radio && !radio.checked) { radio.click(); await var_(150); }
    return true; }
  // mező a felirata alapján: a felirat után következő (látható) input / textarea az ablakon belül
  const mezoFelirat = (ab, cimek, tipus) => { for (const c of cimek) for (const f of felirat(ab, c)) {
      for (let p = f.parentElement; p && p !== ab.parentElement; p = p.parentElement) { const l = [...p.querySelectorAll(tipus)].filter(x => lat(x) && !x.closest('#sfejPanel')); if (l.length === 1) return l[0]; if (l.length > 1) break; } }
    return null; };
  const szovegIr = (el, v) => { if (!el || !v) return 0; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value'); el.focus(); d.set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); return 1; };
  // szín: az ablak színválasztójából a Sikerfüzet-színhez legközelebbi korong / négyzet
  const rgb = s => { const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (m) return m[4] === '0' ? null : [+m[1], +m[2], +m[3]];
    const h = String(s).replace('#', ''); return h.length === 6 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : null; };
  async function szinValaszt(ab, hex) {
    const cel = rgb(hex); if (!cel) return 0;
    let gy = ab; const f = felirat(ab, 'Szín')[0] || felirat(ab, 'Színek')[0]; if (f) for (let p = f.parentElement; p && p !== ab.parentElement; p = p.parentElement) { if (p.querySelectorAll('button,[role="radio"],span,div').length > 3) { gy = p; break; } }
    const korong = [...gy.querySelectorAll('button,[role="radio"],span,div,label')].filter(x => { if (!lat(x) || x.closest('#sfejPanel')) return false; const r = x.getBoundingClientRect();
      if (r.width < 10 || r.width > 48 || Math.abs(r.width - r.height) > 6) return false; const c = rgb(getComputedStyle(x).backgroundColor); return c && !(c[0] > 245 && c[1] > 245 && c[2] > 245); });
    if (korong.length < 3) return 0;
    const tav = x => { const c = rgb(getComputedStyle(x).backgroundColor); return (c[0] - cel[0]) ** 2 + (c[1] - cel[1]) ** 2 + (c[2] - cel[2]) ** 2; };
    const best = korong.sort((a, b) => tav(a) - tav(b))[0]; const r = best.getBoundingClientRect(); egerrel(r.left + r.width / 2, r.top + r.height / 2); await var_(150);
    return 1; }
  // az idő beírása: a Journal időmezői maszkolt / saját komponensek, a sima értékadás nem mindig jut át –
  // ezért kijelölés + „gépelés” (insertText), és ellenőrizzük, hogy tényleg az lett-e az érték
  const idoNorm = s => { const m = String(s || '').match(/(\d{1,2})\s*[:.]\s*(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
  async function idoIr(el, v) {
    if (!el || !v) return 0;
    if (el.type === 'time') { ir(el, v); await var_(80); if (idoNorm(el.value) === v) return 1; }
    for (let k = 0; k < 3; k++) {
      el.focus(); el.click(); await var_(60);
      try { el.select(); } catch (_) {} try { el.setSelectionRange(0, el.value.length); } catch (_) {}
      document.execCommand('selectAll', false); const ok = document.execCommand('insertText', false, v);
      if (!ok) ir(el, v);
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      el.blur(); el.dispatchEvent(new Event('change', { bubbles: true })); await var_(150);
      if (idoNorm(el.value) === v) return 1;
    }
    return 0; }
  // a megnyitott hét naptárába beírja az ide eső, még át nem vitt OVB-időpontokat
  async function idopontokKitolt() {
    const lista = (adat && adat.esem) || []; if (!lista.length) return { db: 0, hiba: [] };
    // a „Heti tervezés” fül, „Hét” nézet
    const ful = gombSzoveg(document, 'Heti tervezés')[0] || felirat(document, 'Heti tervezés')[0]; if (ful) { ful.click(); await var_(700); }
    const het = gombSzoveg(document, 'Hét')[0]; if (het) { het.click(); await var_(500); }
    const osz = await varjRa(() => { const l = napOszlopok(); return l.length >= 5 ? l : null; }, 6000); if (!osz) return { db: 0, hiba: ['a heti naptár nem található'] };
    const { sfejKesz = {} } = await chrome.storage.local.get('sfejKesz');
    const hetben = lista.filter(e => osz.some(o => o.md === e.d.slice(5)));
    let db = 0, fr = 0; const hiba = [];
    // a nap oszlopának vízszintes sávja (a fejléc cellájából)
    const savja = o => { const r = o.el.getBoundingClientRect(); return [r.left - 2, r.right + 2]; };
    // egy időpont a naptárban – csak az adott nap oszlopában (az ismétlődő, azonos című események miatt)
    const levelCimNap = (cim, o) => { const [l, r] = savja(o), k = kis(cim);
      return [...document.querySelectorAll('*')].find(x => { if (!lat(x) || x.children.length !== 0 || x.closest('#sfejPanel')) return false; const t = kis(x.innerText);
        if (t !== k && !(t.length > k.length && t.endsWith(' ' + k))) return false; const b = x.getBoundingClientRect(), cx = b.left + b.width / 2; return cx >= l && cx <= r; }); };
    // foglalt-e a pont: a fölötte lévő elemek között van-e egy esemény-blokk („9:00 - 9:30” szöveggel)
    const foglalt = (x, y) => { let el = document.elementFromPoint(x, y); for (let i = 0; el && i < 7; i++, el = el.parentElement) { if (/\b\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\b/.test(el.innerText || '') && el.getBoundingClientRect().height < 900) return true; } return false; };
    const ujE = ab => /új időpont/.test(kis(ab.innerText));
    const megse = async () => { const m = gombSzoveg(document, 'Mégse')[0]; if (m) m.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await var_(400); };
    const kulcs = e => `${allKod(e.all)}|${e.k}-${e.v}`;
    // az ablak kitöltése (új és meglévő időpontnál is)
    async function kitolt(ab, e, uj) {
      const inp = [...ab.querySelectorAll('input,textarea')].filter(lat);
      if (uj) { if (!(await tipusValaszt(ab, e.tip))) hiba.push(e.cim + ' (típus: ' + e.tip + ')');
        const cimIn = inp.find(i => /^cím/i.test(i.placeholder || '')) || inp.find(i => i.type === 'text'); ir(cimIn, e.cim); }
      const idoMezok = () => [...ab.querySelectorAll('input')].filter(i => lat(i) && (i.type === 'time' || /^\d{1,2}\s*[:.]\s*\d{2}$/.test(String(i.value).trim())));
      let im = idoMezok(); const okK = im[0] ? await idoIr(im[0], e.k) : 0; await var_(200);
      im = idoMezok(); const okV = im[1] ? await idoIr(im[1], e.v) : 0; await var_(150);
      if (!okK || !okV) hiba.push(e.cim + ' (időpont: ' + e.k + '–' + e.v + ')');
      const holIn = mezoFelirat(ab, ['Hol', 'Helyszín'], 'input,textarea') || inp.find(i => /zoom|helysz|hol/i.test(i.placeholder || ''));
      if (holIn && e.hol && !String(holIn.value || '').trim()) szovegIr(holIn, e.hol);
      const jgIn = mezoFelirat(ab, ['Jegyzet', 'Megjegyzés', 'Leírás', 'Megjegyzések'], 'textarea,input') || [...ab.querySelectorAll('textarea')].find(lat);
      if (jgIn && e.jegyzet && jgIn !== holIn && !String(jgIn.value || '').trim()) szovegIr(jgIn, e.jegyzet);
      allapotIr(ab, e.all);
      if (e.szin) await szinValaszt(ab, e.szin);
      await var_(250);
      const ment = gombSzoveg(ab, 'Mentés')[0]; if (!ment) return false;
      ment.click(); return !!(await varjRa(() => !ablak(), 4000));
    }
    for (const e of hetben) {
      const o = napOszlopok().find(x => x.md === e.d.slice(5)); if (!o) { hiba.push(e.cim); continue; }
      const reg = sfejKesz[e.id];
      const [hh, mm] = e.k.split(':').map(Number);
      let c = oraCimke(hh, o.el.getBoundingClientRect().left); if (c) { c.scrollIntoView({ block: 'center' }); await var_(250); }
      const lev = levelCimNap(e.cim, o);
      if (lev) {
        // megvan ezen a napon: ha az idő vagy a megvalósulás még nem egyezik (vagy régi bejegyzés), frissítjük
        if (reg === kulcs(e)) continue;
        (lev.closest('a,[role="button"],.fc-event') || lev).click();
        const ab = await varjRa(ablak, 4000); if (!ab) { hiba.push(e.cim + ' (frissítés)'); continue; }
        if (ujE(ab)) { await megse(); hiba.push(e.cim + ' (frissítés)'); continue; }
        if (await kitolt(ab, e, false)) { fr++; sfejKesz[e.id] = kulcs(e); await chrome.storage.local.set({ sfejKesz }); }
        else { hiba.push(e.cim + ' (frissítés)'); await megse(); }
        await var_(400); continue;
      }
      // nincs ott: ha mi vittük át korábban és azóta eltűnt, a felhasználó törölte – nem hozzuk vissza
      // (a korábbi hiba miatt „már ott van”-nak jelöltek – 1 vagy 'a:?' – viszont pótlódnak)
      if (reg && reg !== 1 && reg !== 'a:?') continue;
      // új időpont: egy szabad pontra kattintunk az adott nap oszlopában (foglalt helyre kattintva a meglévő nyílna meg)
      c = oraCimke(hh, o.el.getBoundingClientRect().left);
      const r = o.el.getBoundingClientRect(), xs = [r.left + r.width / 2, r.right - 8, r.left + 10];
      const ys = []; if (c) { const c2 = oraCimke(hh + 1, r.left), cr = c.getBoundingClientRect(), mag = c2 ? c2.getBoundingClientRect().top - cr.top : 60; ys.push(cr.top + Math.min(mag - 4, Math.max(4, mag * mm / 60 + 4))); }
      for (let h = 6; h <= 22; h++) { const ch = oraCimke(h, r.left); if (ch) { const t = ch.getBoundingClientRect().top + 10; if (t > 0 && t < innerHeight - 10) ys.push(t); } }
      let ab = null;
      for (const y of ys) { for (const x of xs) { if (foglalt(x, y)) continue; egerrel(x, y); ab = await varjRa(ablak, 3000); if (ab && !ujE(ab)) { await megse(); ab = null; } if (ab) break; } if (ab) break; }
      if (!ab) { hiba.push(e.cim + ' (nem találtam szabad helyet a napon)'); continue; }
      // a dátum: az ablak a kattintott napot mutatja – ellenőrizzük
      const [, mo, nap] = e.d.split('-').map(Number), datSz = `${HO_ROV[mo - 1]} ${nap}.`;
      const datIn = [...ab.querySelectorAll('input[type="date"]')][0];
      if (datIn) ir(datIn, e.d);
      else if (!kis(ab.innerText).includes(kis(datSz))) { await megse(); hiba.push(e.cim + ' (dátum)'); continue; }
      if (await kitolt(ab, e, true)) { db++; sfejKesz[e.id] = kulcs(e); await chrome.storage.local.set({ sfejKesz }); }
      else { hiba.push(e.cim); await megse(); }
      await var_(500);
    }
    await chrome.storage.local.set({ sfejKesz });
    return { db, fr, hiba };
  }
  // ---- automatikus belépés (e-mail + jelszó a Sikerfüzet beállításaiból) ----
  const belepoMezok = () => { const js = [...document.querySelectorAll('input[type="password"]')].find(lat); if (!js) return null;
    const gy = js.closest('form') || js.parentElement.closest('div,section,main') || document.body;
    let em = [...gy.querySelectorAll('input')].find(i => lat(i) && i !== js && (i.type === 'email' || /mail|user|felhaszn|login/i.test(i.name + i.id + i.placeholder + i.autocomplete)));
    if (!em) for (let p = js.parentElement; p && p !== document.body && !em; p = p.parentElement) em = [...p.querySelectorAll('input')].find(i => lat(i) && i !== js && ['email', 'text'].includes(i.type));
    const gombok = [...(js.closest('form') || document).querySelectorAll('button,[type="submit"],[role="button"]')].filter(b => lat(b) && !b.closest('#sfejPanel'));
    const gomb = gombok.find(b => b.type === 'submit') || gombok.find(b => /belép|bejelentkez|login|log in|sign in|anmeld|einlogg/i.test(b.innerText || b.value || ''));
    return em ? { em, js, gomb } : null; };
  let belepFolyik = false;
  async function belepes(m) {
    if (belepFolyik) return true; belepFolyik = true;
    try {
      const { sfejBelep: b, sfejBelepProba: pr, sfejBelepRossz: rossz } = await chrome.storage.local.get(['sfejBelep', 'sfejBelepProba', 'sfejBelepRossz']);
      // hibás adatokkal nem próbálkozunk újra (nehogy zárolják a fiókot) – csak ha a Sikerfüzetben megváltoztak
      if (b && rossz && rossz === b.email + '\n' + b.jelszo) { rajz('A belépés nem sikerült.\nEllenőrizd az e-mailt és a jelszót a Sikerfüzetben (Beállítások → Kapcsolatok), vagy lépj be kézzel.'); return true; }
      if (!b) { rajz('Az Erfolgsjournalba be kell lépni.\nHa a Sikerfüzet Beállítások → Kapcsolatok részében megadod az e-mailt és a jelszót, legközelebb magától belépek.'); return true; }
      if (pr && Date.now() - pr < 45000) { rajz('A belépés nem sikerült.\nEllenőrizd az e-mailt és a jelszót a Sikerfüzetben (Beállítások → Kapcsolatok), vagy lépj be kézzel.'); return true; }
      await chrome.storage.local.set({ sfejBelepProba: Date.now() });
      rajz('Belépés az Erfolgsjournalba…');
      ir(m.em, b.email); await var_(150); ir(m.js, b.jelszo); await var_(300);
      if (m.gomb) m.gomb.click(); else { const f = m.js.closest('form'); if (f && f.requestSubmit) f.requestSubmit(); else m.js.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
      // siker esetén eltűnik a jelszómező (vagy új oldal tölt be)
      if (await varjRa(() => !belepoMezok(), 10000)) { await chrome.storage.local.remove(['sfejBelepProba', 'sfejBelepRossz']); panel.remove(); utolso = ''; }
      else await chrome.storage.local.set({ sfejBelepRossz: b.email + '\n' + b.jelszo });
      return true;
    } finally { belepFolyik = false; }
  }
  // diagnosztika: hány OVB-időpont jött át a Sikerfüzetből a megadott hónapra
  const idopontSzoveg = (ev, ho) => {
    if (!adat || !Array.isArray(adat.esem)) return '\nOVB-időpontok: NEM jöttek át a Sikerfüzetből (nincs Google Naptár kapcsolat, vagy nyisd meg előbb a Sikerfüzet Havi tervét Chrome-ban).';
    const elo = `${ev}-${String(+ho).padStart(2, '0')}`, n = adat.esem.filter(e => String(e.d).startsWith(elo)).length;
    return `\nOVB-időpontok a Sikerfüzetből erre a hónapra: ${n}${n ? '' : ' (a naptárban nincs felismert OVB-esemény)'}`;
  };
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
          const vege = `Kész ✓ – ${f.ev}. ${f.ho}. hónap: ${f.hetek.length} hét, ${f.db} mező kitöltve${f.idp ? `, ${f.idp} időpont beírva` : ''}${f.idfr ? `, ${f.idfr} állapot frissítve` : ''}${f.h321 ? `, ${f.h321} név a 3-2-1-be` : ''}.${adat && Array.isArray(adat.esem) ? '' : '\nIdőpontok: nem jöttek át a Sikerfüzetből (Google Naptár kapcsolat?).'}${f.hiba.length ? '\nNem sikerült: ' + f.hiba.join(', ') : ''}\nNézd át, és véglegesítsd, ahogy eddig.`;
          await chrome.storage.local.remove('sfejFeladat');
          // visszamenőleges sor: ha van még hónap utána, oda lépünk, és ott magától folytatódik
          const sor = (adat && adat.sor) || [], hk = `${f.ev}-${+f.ho}`, i = sor.indexOf(hk), kov = i >= 0 ? sor[i + 1] : null;
          const { sfejSorOssz = [] } = await chrome.storage.local.get('sfejSorOssz');
          if (kov) { const [ky, km] = kov.split('-'); const ut = `/month/${ky}/${km}`;
            await chrome.storage.local.set({ sfejSorOssz: [...sfejSorOssz, `${f.ev}. ${f.ho}.: ${f.db} mező${f.idp ? `, ${f.idp} időpont` : ''}${f.hiba.length ? `, ${f.hiba.length} hiba` : ''}`], sfejAuto: { ut, ido: Date.now() } });
            rajz(`${f.ev}. ${f.ho}. kész ✓ – jön: ${ky}. ${km}.`); location.href = ut; return; }
          const ossz = sfejSorOssz.length ? 'Előző hónapok:\n' + sfejSorOssz.join('\n') + '\n\n' : '';
          await chrome.storage.local.remove('sfejSorOssz');
          await chrome.storage.local.set({ sfejVege: ossz + vege });
          rajz(ossz + vege);
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
          // a CÉL / VAN rész nem mindig az elsőként nyitott fülön van: ha nem látszik, a fülek közt megkeressük
          let cv = await varjRa(() => kartya('CÉL / VAN'), 4000);
          for (const fn of ['Heti tervezés', 'Áttekintés', 'Heti célok']) { if (cv) break; const fb = gombSzoveg(document, fn)[0] || felirat(document, fn)[0]; if (fb) { fb.click(); cv = await varjRa(() => kartya('CÉL / VAN'), 3000); } }
          if (cv) {
            await var_(500);
            const uzi = hetKitolt(kw), m = uzi.match(/(\d+) mező/); f.db += m ? +m[1] : 0; ok = !!m;
            await var_(1800);   // az Erfolgsjournal automatikus mentésének ideje
            if (adat.esem && adat.esem.length) { rajz(`Egész hónap kitöltése…\n${kw}. hét (${f.i + 1} / ${f.hetek.length}) – időpontok`);
              try { const r = await idopontokKitolt(); f.idp = (f.idp || 0) + r.db; f.idfr = (f.idfr || 0) + (r.fr || 0); if (r.hiba.length) f.hiba.push(...r.hiba.map(x => `${kw}. hét: ${x}`)); } catch (_) {} }
            rajz(`Egész hónap kitöltése…\n${kw}. hét (${f.i + 1} / ${f.hetek.length}) – 3-2-1`);
            try { const r = await h321Kitolt(kw); f.h321 = (f.h321 || 0) + r.db; if (r.hiba.length) f.hiba.push(...r.hiba.map(x => `${kw}. hét 3-2-1: ${x}`)); } catch (_) {}
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
    // belépőoldal → belépünk; utána (ha a kitöltés még vár) a kért hónapra lépünk
    const bm = belepoMezok(); if (bm) { await belepes(bm); return; }
    try { const { sfejAuto } = await chrome.storage.local.get('sfejAuto');
      if (sfejAuto && Date.now() - sfejAuto.ido < 30 * 60 * 1000 && location.pathname !== sfejAuto.ut && !/^\/(month|week)\//.test(location.pathname)) {
        const { sfejFeladat } = await chrome.storage.local.get('sfejFeladat');
        if (!sfejFeladat && !sfejAuto.at) { await chrome.storage.local.set({ sfejAuto: { ...sfejAuto, at: 1 } }); location.href = sfejAuto.ut; return; } } } catch (_) {}
    try { const { sfejFeladat: f } = await chrome.storage.local.get('sfejFeladat'); if (f) { if (!adat) adat = await adatKer(); if (adat && (kartya('CÉL / VAN') || kartya('3-2-1 · Saját pénzem') || kartya('Havi képlet'))) { folytat(); return; } } } catch (_) {}
    const hoM = location.pathname.match(/month\/(\d{4})\/(\d{1,2})/);
    const kulcs = location.pathname;
    const havi = hoM && kartya('Havi képlet'), heti = !havi && (kartya('CÉL / VAN') || kartya('3-2-1 · Saját pénzem'));
    if (!havi && !heti) { if (utolso !== kulcs) { utolso = kulcs; panel.remove(); } return; }
    if (bezart === kulcs || (utolso === kulcs && panel.isConnected)) return;
    utolso = kulcs;
    if (!adat) { rajz('Számok betöltése…'); adat = await adatKer(); }
    if (!adat) { rajz('Még nincs átvehető adat.\nNyisd meg Chrome-ban a Sikerfüzet Havi tervét (vagy nyomd meg ott a „Kitöltés az Erfolgsjournalban” gombot) – a számok onnan magától átjönnek.',
        `<button data-ujra style="${gomb};margin-top:8px;background:#fff;color:#0f2a52">Újrapróbálom</button>`);
      panel.querySelector('[data-ujra]').onclick = async () => { adat = await adatKer(); utolso = ''; vizsgal(); }; return; }
    if (havi) {
      // a hónap a címben van → biztonságosan, magától (laponként egyszer)
      try { const { sfejVege } = await chrome.storage.local.get('sfejVege'); if (sfejVege) { await chrome.storage.local.remove('sfejVege'); kesz.add('ho:' + kulcs);
        rajz(sfejVege, `<button data-ujra style="${gomb};margin-top:8px;background:#fff;color:#0f2a52">Csak a képlet újra</button>`);
        panel.querySelector('[data-ujra]').onclick = () => { const r = honapKitolt(hoM[1], hoM[2]); panel.querySelector('[data-all]').textContent = r.uzi; }; return; } } catch (_) {}
      // a Sikerfüzet gombjával nyitva → magától végigmegy az egész hónapon
      try { const { sfejAuto } = await chrome.storage.local.get('sfejAuto');
        if (sfejAuto && sfejAuto.ut === kulcs && Date.now() - sfejAuto.ido < 30 * 60 * 1000) { await chrome.storage.local.remove('sfejAuto');
          kesz.add('ho:' + kulcs); honapKitolt(hoM[1], hoM[2]); honapInditas(hoM[1], hoM[2]); return; } } catch (_) {}
      const k = 'ho:' + kulcs;
      const eredm = kesz.has(k) ? null : honapKitolt(hoM[1], hoM[2]); kesz.add(k);
      const hh = adat.honapok && adat.honapok[`${hoM[1]}-${+hoM[2]}`], n = hh ? hh.hetek.length : 0;
      rajz((eredm ? eredm.uzi : 'A havi célok és a képlet ki vannak töltve.') + idopontSzoveg(hoM[1], hoM[2]) + (n ? `\n\nA hetek Cél / Van számai: „Egész hónap kitöltése” (${n} hét, sorban végigmegy rajtuk).` : ''),
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
      { const b3 = document.createElement('button'); b3.style.cssText = gomb + ';margin-top:6px;width:100%;background:#fff;color:#0f2a52'; b3.textContent = '3-2-1 kitöltése a választott hétre';
        panel.appendChild(b3); b3.onclick = async () => { b3.disabled = true; b3.textContent = 'Beírás…'; const kw = +panel.querySelector('[data-het]').value; const r = await h321Kitolt(kw);
          b3.textContent = r.nincs ? 'Erre a hétre nincs 3-2-1 lista a Sikerfüzetben' : `${r.db} név beírva ✓${r.hiba.length ? ' · nem sikerült: ' + r.hiba.length : ''}`; if (r.hiba.length) b3.title = r.hiba.join('\n'); b3.disabled = false; }; }
      if (adat.esem && adat.esem.length) { const b = document.createElement('button'); b.style.cssText = gomb + ';margin-top:6px;width:100%;background:#fff;color:#0f2a52'; b.textContent = 'Időpontok beírása erre a hétre';
        panel.appendChild(b); b.onclick = async () => { b.disabled = true; b.textContent = 'Beírás…'; const r = await idopontokKitolt();
          b.textContent = `${r.db} időpont beírva${r.fr ? `, ${r.fr} állapot frissítve` : ''} ✓${r.hiba.length ? ' · nem sikerült: ' + r.hiba.length : ''}`; if (r.hiba.length) b.title = r.hiba.join('\n'); }; }
    }
  }
  // ha a Sikerfüzet közben átadja (vagy frissíti) a számokat, magától újrarajzolunk – nem kell gombot nyomni
  try { chrome.storage.onChanged.addListener((v, hol) => { if (hol !== 'local') return; if (v.sfejAdat && v.sfejAdat.newValue) adat = v.sfejAdat.newValue; if (futFolyik) return;
    if (v.sfejAdat && v.sfejAdat.newValue) { adat = v.sfejAdat.newValue; utolso = ''; kesz.clear(); bezart = ''; vizsgal(); }
    else if (v.sfejAuto && v.sfejAuto.newValue) { utolso = ''; vizsgal(); } }); } catch (_) {}
  // az app tartalma késve rajzolódik ki, és lapváltáskor cserélődik – figyeljük
  setInterval(vizsgal, 1000); vizsgal();
})();
