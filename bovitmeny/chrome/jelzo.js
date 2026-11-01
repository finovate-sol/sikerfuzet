// A Sikerfüzet lapján fut.
// 1) Jelzi, hogy a bővítmény telepítve van (és melyik verzió) – így a „Kitöltés az Erfolgsjournalban”
//    gomb tudja, hogy rögtön indulhat, vagy előbb le kell tölteni.
// 2) A Sikerfüzet ide adja át a havi terv számait (window.postMessage), mi elmentjük a bővítmény tárhelyére –
//    így az Erfolgsjournal akkor is megkapja őket, ha a cím # része útközben elveszne.
document.documentElement.dataset.sfejBov = chrome.runtime.getManifest().version;
window.addEventListener('message', e => {
  if (e.source !== window || !e.data || !e.data.sfejMent) return;
  const o = { sfejAdat: e.data.sfejMent, sfejIdo: Date.now() };
  if (e.data.ut) o.sfejAuto = { ut: e.data.ut, ido: Date.now() };
  // Erfolgsjournal belépés (Sikerfüzet → Beállítások → Kapcsolatok); ha ott törölték, itt is töröljük
  if (e.data.belep && e.data.belep.email && e.data.belep.jelszo) o.sfejBelep = { email: e.data.belep.email, jelszo: e.data.belep.jelszo };
  else if ('belep' in e.data) { try { chrome.storage.local.remove('sfejBelep'); } catch (_) {} }
  try { chrome.storage.local.set(o); } catch (_) {}
});
