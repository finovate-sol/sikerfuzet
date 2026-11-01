// Sikerfüzet → Erfolgsjournal: a lap betöltésének legelején fut. Ha a címben ott vannak a Sikerfüzet számai
// (#sfej=…, a Sikerfüzet „Erfolgsjournal megnyitása” gombja teszi oda), elmenti őket a bővítmény tárhelyére,
// és kiveszi a címből, hogy az Erfolgsjournal ne lássa / ne zavarja.
(() => {
  const m = location.hash.match(/sfej=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/'), pad = '='.repeat((4 - b.length % 4) % 4);
    const adat = JSON.parse(decodeURIComponent(escape(atob(b + pad))));
    const o = { sfejAdat: adat, sfejIdo: Date.now() };
    // „auto”: a Sikerfüzet gombja indította → a havi oldalon magától indul az egész hónap kitöltése
    if (adat && adat.auto) o.sfejAuto = { ut: location.pathname, ido: Date.now() };
    // ha a címben nincsenek ügyfél-időpontok, de a Sikerfüzet már közvetlenül átadta őket, azokat megtartjuk
    chrome.storage.local.get('sfejAdat').then(r => { const reg = r && r.sfejAdat;
      if (adat && !adat.esem && reg && reg.esem) adat.esem = reg.esem; chrome.storage.local.set(o); }, () => chrome.storage.local.set(o));
  } catch (e) {}
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
})();
