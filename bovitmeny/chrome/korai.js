// Sikerfüzet → Erfolgsjournal: a lap betöltésének legelején fut. Ha a címben ott vannak a Sikerfüzet számai
// (#sfej=…, a Sikerfüzet „Erfolgsjournal megnyitása” gombja teszi oda), elmenti őket a bővítmény tárhelyére,
// és kiveszi a címből, hogy az Erfolgsjournal ne lássa / ne zavarja.
(() => {
  const m = location.hash.match(/sfej=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/'), pad = '='.repeat((4 - b.length % 4) % 4);
    const adat = JSON.parse(decodeURIComponent(escape(atob(b + pad))));
    chrome.storage.local.set({ sfejAdat: adat, sfejIdo: Date.now() });
  } catch (e) {}
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
})();
