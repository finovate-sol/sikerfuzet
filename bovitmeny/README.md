# Sikerfüzet → Erfolgsjournal (Chrome-bővítmény)

A `chrome/` mappa egy Chrome / Edge bővítmény (Manifest V3). Az Erfolgsjournal oldalán fut:

- A Sikerfüzet Havi tervének **„Kitöltés az Erfolgsjournalban”** gombja megnyitja a hónapot, a számokat a cím `#sfej=…`
  részében adja át (a `korai.js` elmenti a bővítmény tárhelyére és kiveszi a címből).
- A havi oldalon a bővítmény magától beírja a *Célom pénzben*, *Célom ES-ben* értékeket és a *Havi képletet*, majd sorban
  végigmegy a hónap hetein, és mindegyikbe beírja a Cél / Van (és Szerviz) számokat; a végén visszaáll a havi oldalra.
- A heti oldalak *Heti tervezés* naptárába az ügyfél-időpontokat (címben `(E)`, `(TA)`, `(SZ)`) is beírja az *Új időpont*
  ablakon át; az átvitteket megjegyzi (`sfejKesz`), így nem duplikál.
- A panel jobb felül látszik; a heti oldalon egy kiválasztott hét kézzel is kitölthető.

A mezőket a feliratuk alapján keresi, nem az Erfolgsjournal belső kódja alapján.

## Terjesztés
A GitHub Pages kiadás (`.github/workflows/deploy-pages.yml`) minden alkalommal `bovitmeny/sikerfuzet-ej.zip`-be
csomagolja a `chrome/` mappát. A Havi terv „Kitöltés az Erfolgsjournalban” gombja magától letölti, ha a bővítmény
nincs telepítve vagy régi (a `jelzo.js` a Sikerfüzet lapján jelzi a verziót, és ott veszi át a számokat is).

## Telepítés
1. ZIP kicsomagolása egy maradandó mappába.
2. `chrome://extensions` (Edge: `edge://extensions`) → *Fejlesztői mód* be.
3. *Kicsomagolt bővítmény betöltése* → a kicsomagolt mappa.

Frissítéskor: új ZIP kicsomagolása ugyanabba a mappába, majd a bővítmény kártyáján az ↻ (Újratöltés) gomb.
