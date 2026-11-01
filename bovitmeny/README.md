# Sikerfüzet → Erfolgsjournal (Chrome-bővítmény)

A `chrome/` mappa egy Chrome / Edge bővítmény (Manifest V3). Az Erfolgsjournal oldalán fut:

- **Havi terv oldal** (`/month/ÉÉÉÉ/H`): magától beírja a *Célom pénzben*, *Célom ES-ben* értékeket és a *Havi képletet*.
- **Aktuális hét oldal** (*CÉL / VAN · Heti célok*): a jobb alsó panelen kiválasztott hét Cél és Van számait egy kattintással.

A számokat a megnyitó Sikerfüzet-laptól kéri el (Havi terv → „Erfolgsjournal megnyitása”), különben a vágólapról
(a megnyitás oda is kiteszi). A mezőket a feliratuk alapján keresi, nem az Erfolgsjournal belső kódja alapján.

## Terjesztés
A GitHub Pages kiadás (`.github/workflows/deploy-pages.yml`) minden alkalommal `bovitmeny/sikerfuzet-ej.zip`-be
csomagolja a `chrome/` mappát; a Havi terv Erfolgsjournal-kártyájáról tölthető le.

## Telepítés
1. ZIP kicsomagolása egy maradandó mappába.
2. `chrome://extensions` (Edge: `edge://extensions`) → *Fejlesztői mód* be.
3. *Kicsomagolt bővítmény betöltése* → a kicsomagolt mappa.

Frissítéskor: új ZIP kicsomagolása ugyanabba a mappába, majd a bővítmény kártyáján az ↻ (Újratöltés) gomb.
