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
  try { chrome.storage.local.set(o); } catch (_) {}
});
