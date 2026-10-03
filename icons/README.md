# Ikonok

Két ikonkészlet él egymás mellett; hogy melyiket viseli az app, azt az
Admin → Ikon fülön lehet átállítani (a választás a `config/app`
dokumentum `appIcon` mezőjében, mindenkire érvényesen).

| mappa       | név           | motívum                                   |
|-------------|---------------|-------------------------------------------|
| `fuzet/`    | Nyitott füzet (alap) | zöld–kék nyitott füzet sorokkal, fekete kerettel |
| `emelkedo/` | Emelkedő      | felfelé tartó nyíl (manifest: `manifest-emelkedo.json`) |

Mindkettő fehér lapon áll, és a rajz kitölti a lapot, mint a Tükör ikonjainál.
Az alap (Nyitott füzet) a Tükör szemével egy családba tartozik: ugyanaz a háttér,
ugyanolyan vastag, színátmenetes fekete keret és puha árnyék.

## Melyik fájl mire való

- `icon.svg`, `icon-16/32/192/512.png` – lekerekített sarkú lap.
  Böngészőfül, és a manifest `purpose: "any"` bejegyzései.
- `icon-180.png` – **teli négyzet**, lekerekítés nélkül: az apple-touch-icon,
  mert a sarkot maga az iOS vágja le. Lekerekítve dupla lekerekítés lenne.
- `icon-maskable.svg`, `icon-192/512-maskable.png` – teli négyzet, a rajz a
  biztonságos zónába húzva (0,74×): az Android ebbe vág bele tetszőleges alakot.

## Újragenerálás

A PNG-k az SVG-kből származnak, fejetlen Chromiummal renderelve. A rajz
forrása maga az `icon.svg` / `icon-maskable.svg` – azokat kell átírni,
a PNG-ket utána újra kell renderelni ugyanabban a hét méretben.

## Tükör (a privát rész külön appként)

Privát módban a lap neve, ikonja és manifestje Tükörre vált, a cím
`?app=elet`-et kap. Ha innen adják a kezdőképernyőhöz, az ikon mindig a privát
részre nyílik. Az ikon a privát rész beállításaiban (fogaskerék a Privát mód
kapcsoló mellett) választható, eszközönként (`localStorage: sf_elet_icon`).

| mappa            | név           | manifest                      |
|------------------|---------------|-------------------------------|
| `tukor-szem/`    | Szem (alap)   | `manifest-tukor-szem.json`    |
| `elet-lotusz/`   | Aurora-lótusz | `manifest-elet-lotusz.json`   |
| `elet-vegtelen/` | Végtelen      | `manifest-elet-vegtelen.json` |

Fehér alapúak; a fájlok szerepe ugyanaz, mint fent (az `icon-180.png` teli
négyzet, a maskable változatban a rajz 0,8×-re húzva).
