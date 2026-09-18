# Ikonok

Két ikonkészlet él egymás mellett; hogy melyiket viseli az app, azt az
Admin → Ikon fülön lehet átállítani (a választás a `config/app`
dokumentum `appIcon` mezőjében, mindenkire érvényesen).

| mappa       | név           | motívum                                   |
|-------------|---------------|-------------------------------------------|
| `emelkedo/` | Emelkedő      | felfelé tartó nyíl                        |
| `fuzet/`    | Nyitott füzet | nyitott füzet fehér lapokkal              |

Mindkettő ugyanazt a színátmenetet viseli (`#2E86FF` → `#0A2E6B`), hogy
váltáskor ugyanannak az appnak a két arca legyen, ne két különböző appé.

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
