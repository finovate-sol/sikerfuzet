# Handoff: Sikerfüzet – navigáció, rögzítés és Pénzügyek redesign

## Overview
Új vizuális irány és navigációs modell a Sikerfüzet apphoz (repo: `finovate-sol/sikerfuzet`), és a teljes Pénzügyek modul újratervezése mind a 7 aloldallal. Célok: kevesebb ikonos, nehezen érthető gomb; gyors rögzítés minden képernyőről; egységes fejléc / fülsor / alsó sáv minden modulban.

## About the Design Files
A mellékelt `.dc.html` fájlok **HTML-ben készült design-referenciák** (működő prototípusok), nem production kód. A feladat ezeket **újraépíteni a meglévő app környezetében** (a repo jelenlegi stack-je: vanilla JS + Firebase, Lucide ikonok `ikonok/lucide-stoa.js`, Outfit font), a meglévő mintákkal és adatréteggel. A fájlok böngészőben közvetlenül megnyithatók (a `support.js` futtatja őket); a logika a fájl alján lévő `class Component` blokkban olvasható.

## Fidelity
**High-fidelity.** Végleges színek, tipográfia, térközök, interakciók. Pixelpontosan kell visszaépíteni.

---

## Design Tokens

### Színek – „Óceán” téma (alapértelmezett)
| Token | Hex | Használat |
|---|---|---|
| `--color-bg` | `#eaf0f1` | oldal háttér, kártyán belüli „lyuk” elemek |
| `--color-surface` | `#d8e3e6` | kártyák, inaktív gombok, billentyűk |
| `--color-text` | `#14222a` | szöveg, sötét alsó sáv, aktív fül |
| `--color-neutral-500` | `#6b7f88` | másodlagos szöveg alapja |
| `--color-accent` | `#2f6f8f` | elsődleges (kék): + gomb, primer gomb, **bevétel / pozitív** |
| `--color-accent-2` | `#e07a5f` | második (korall): **kiadás, túllépés, figyelmeztetés** |

Tónusskálák (100–900) mindkét akcentusra és a neutralra, OKLCH keveréssel:
- 100 = 10% alap + fehér · 200 = 22% + fehér · 300 = 40% + fehér · 400 = 70% + fehér
- 600 = 85% alap + fekete · 700 = 68% + fekete · 800 = 50% + fekete · 900 = 32% + fekete
- CSS: `color-mix(in oklch, #2f6f8f 22%, white)` stb.
- `--color-neutral-200` (vászon háttér) = `color-mix(in oklch, #d8e3e6 92%, #14222a 8%)`
- **Fontos:** Óceán témában az accent-100 túl közel van a bg-hez → kitöltésre min. **accent-200**, rajta accent-900 szöveg.

**Színjelentés (kötelező):** bevétel/pozitív = kék (accent / accent-800 szöveg); kiadás/negatív/túllépés = korall (accent-2 / accent-2-800 szöveg).

### Tipográfia – „Modern” párosítás
- Címsor: **Bricolage Grotesque** 600/700 (Google Fonts)
- Szöveg: **DM Sans** 400/500/600/700
- (Ha az Outfitnál maradtok, a címsorokat Bricolage-ra cseréljétek, a törzsszöveg lehet Outfit.)

| Szerep | Méret / súly |
|---|---|
| Modulcím (h2) | 34–36px, heading, 400, lh 1.05 |
| Nagy összeg (hero) | 40px heading |
| Panel összeg | 30–36px heading |
| Kártya érték | 19–22px, 700 |
| Lista cím | 14–15px, 700 |
| Meta / alcím | 12–13px, 400–600, `neutral-700` |
| Kicker (nagybetűs) | 11–12px, 700, letter-spacing .06em, uppercase |

### Formák
- `--radius-sm` 8px · `--radius-md` 16px · `--radius-lg` 28px (kártyák)
- Hero kártyák / bottom sheet felső sarok: 36px
- Gombok, chipek, inputok, fülek: **999px** (pirula)
- Ikon körök: 40–46px, 999px
- Árnyék: `sm 0 1px 2px rgba(46,43,37,.14)` · `md 0 3px 10px rgba(46,43,37,.16)` · `lg 0 12px 32px rgba(46,43,37,.22)`

### Ikonok
Lucide, **stroke-width 2.75**, 18–22px. (A repo `ikonok/lucide-stoa.js` készlete használható.)

### Térköz
Képernyő oldalpadding 20px; blokkok közti gap 16px; kártya padding 14–18px; listasor padding 10px; chip gap 6px.

---

## Globális navigáció (`Sikerfüzet Navigáció.dc.html`)

### Alsó sáv (minden képernyőn)
- Lebegő pirula: `left/right 14px, bottom 18px, height 72px`, bg `--color-text`, shadow-lg.
- Grid: `1fr 1fr 84px 1fr 1fr` → **Ma · Kedvenc1 · [+] · Kedvenc2 · Összes**.
- Elem: ikon 22px + címke 11px/700; inaktív szín `bg 70%`, aktív `accent-300`.
- **+ gomb:** 66×66, `margin-top:-26px`, bg accent, 5px `--color-bg` keret, fehér + ikon (stroke 3). Mindig a Rögzítés panelt nyitja.
- Kedvencek az Összes oldalon ★ gombbal cserélhetők (2 hely, a legrégebbi esik ki).

### Összes oldal
- Fejléc: cím „Összes” + kerek kereső gomb (44px, surface) + fiók gomb („S”, 44px, text bg). Fiók → lenyíló: e-mail, „Privát mód · Stoa”, Beállítások / Fiókváltás / Kijelentkezés.
- Kereső gombra megjelenik a keresőmező.
- Modulok csoportokban (Napi, Test, Fejlődés, Gyűjtemények), **2 oszlopos kártyarács**: illusztráció 60px, név 15/700, leírás 12px, ★ jobb felső sarokban.

### Modul fejléc + fülsor („Hibrid”)
- Cím (heading) + ▾ (koppintás → Összes) + illusztráció 56px + kereső gomb.
- Fülsor: az első **3 aloldal látható fülként** (44px magas pirulák, 13px/700, aktív: text bg + bg szöveg; inaktív: 2px `neutral-300` belső keret), utána **44px kerek „Több ▾” gomb** → lenyíló lista (230px, radius 28, shadow-lg, sorok 48px ikon + címke + ✓).
- Ha az aktív aloldal a listában van: 2 fül látszik + a Több gomb az aktív nevét mutatja (text bg).
- Nincs vízszintes görgetés.

### Rögzítés panel (globális +)
Bottom sheet, radius 36 felül, backdrop text 45%.
- Felül „Ehhez az oldalhoz” kontextus-gomb (pl. Edzésnél „Mai edzés kész”), alatta „↻ Ismét: …” chip.
- Rács elrendezés (alapértelmezett: **Kiemelt**): 2 nagy színes csempe (96px, radius 28; 1. accent, 2. accent-2) + többi 5 oszlopban 52px lekerekített négyzet ikonnal.
- 12 művelet: Költés, Bevétel, Víz +1, Alvás, Testsúly, Edzés kész, Szokás, Napló, Jegyzet, Link, Kiszemelt, Esemény. Víz/Edzés/Szokás azonnali (toast), a többi al-nézet.
- Toast: felül középen, pirula, text bg, ikon/illusztráció 44px + „Rögzítve” kicker.

### Illusztrációk
Két sablon (`Illu.dc.html`): **Ikon-jelenet** (puha körök/foltok accent-200 / accent-2-300 / accent színekben + középen 52%-os bg korong az ikonnal) és **Matrica**. Helyek: Ma fejléc, modul fejléc, Összes kártyák, üres állapotok, sikertoast, mérföldkő kártya.

---

## Pénzügyek (`Pénzügyek.dc.html`)
Aloldalak: **Összkép · Hónap · Tranzakciók** (látható) | Tárcák · Előfizetések · Nettó vagyon · Beállítások (Több). A Vagyon és Hitelek összevonva „Nettó vagyon”-ná.

### Összkép
1. Egyenleg kártya: bg accent-200, radius 36, díszkörök accent-300 / accent-2-300; „Számlák egyenlege” 13px, összeg 40px heading, „● ● ● ● 4 tárca ›” pirula (→ Tárcák).
2. Okos jelzések (max 2, ✕-szel elrejthető): accent-2-100 bg, ikon + szöveg 13/700 + akció gomb. Szabály: legjobban fogyó keret ≥80% → „X keret Y%-nál tart / túllépve Z-vel”; közelgő terhelés ≤7 nap.
3. Hónapváltó (egységes komponens mindenhol): surface sáv 4px padding, 3 gomb (Szept. / Okt. / Ez a hónap), aktív bg + shadow-sm.
4. Bevétel / Kiadás kártyák (2 oszlop, surface) színes ponttal + %-os eltérés az előző hónaphoz; Megtakarítás teljes szélességben (+ „x% a bevételből”).
5. Közelgő kifizetések (3 sor, ismétlődés ikon).
6. Havi pénzáramlás: oszloppárok (bevétel accent-300, kiadás accent-2-300, 12px széles, felül kerek), megtakarítás vonal (text, 2.5px). **Koppintható hónap** → kiemelés + infósor: „Máj 2026 +4,3 M −2,4 M = 1,9 M”.
7. Kiadások kategóriánként: sor = név › + összeg + 8px csík; koppintás → Kategória-részletező.
8. Nettó vagyon sor → Nettó vagyon oldal.

### Hónap
Keret-gyűrű (120px, 14px vonal, accent; túllépésnél accent-2) + „X Ft a Y keretből”; előrejelzés sáv (accent-2-100); Havi keretek lista csíkkal, túllépés korall. „Beállítás” → Keretek szerkesztése.

### Tranzakciók
Cash-flow kártya (±, bevétel kék / kiadás korall), hónapváltó, **Lista | Naptár** váltó, kereső (név + alkategória + tárca), kategória-szűrő chipek, napokra csoportosított lista. Sor: kategória ikon körben (kategóriaszín 25% + bg), név, meta „idő · tárca · kategória · alkategória”, összeg. Koppintás → részletek bottom sheet (Tárca, Kategória, Alkategória, Forrás; Szerkesztés / Felosztás).
- **Naptár:** 7 oszlopos hétfő-kezdetű rács, cella aspect 1, radius 12; háttér intenzitás = napi kiadás / havi max (accent-2 15–85%); nap kiválasztása szűri a listát.

### Tárcák
Összeg, „+ Új tárca”, „Egyeztetés”; 2 oszlopos kártyák (text / accent-2-800 / accent-700 / accent-900), lista egyeztetési állapottal.

### Előfizetések
Havi összeg, éves becslés, megoszlás-csík, lista → Előfizetés-részletező (idei/éves összeg, ártörténet, lemondás-emlékeztető kapcsoló 50×28).

### Nettó vagyon
Nettó = eszközök − tartozás; donut (pénztárcák / befektetés / egyéb), vagyonelemek listája (hozam kékkel), tartozások szekció üres állapottal.

### Beállítások
Összkép elrendezése, Havi keretek (→ szerkesztő), Kategóriák, Importálás (→ CSV-import); Tranzakció-logók: saját szabályok + szolgáltatók logó nélkül szűrővel.

### Al-képernyők (teljes képernyős panel, vissza gombbal)
- **Felosztás:** sorok = kategória (koppintás: következő kategória) + −/+ 1000 Ft + összeg (koppintás: maradék hozzáadása); állapot sáv; mentés csak 0 maradéknál.
- **Egyenleg-egyeztetés:** tárcánként app-egyenleg + valós egyenleg input → eltérés → korrekciós tétel.
- **Keretek szerkesztése:** összkeret fejléc + októberi tény; soronként range slider (step 1000), referencia szöveg (túllépésnél korall).
- **CSV-import:** 3 lépés (fájl → oszloppárosítás → előnézet duplikátumjelöléssel) + progress sáv.
- **Kategória-részletező:** 6 havi oszlopdiagram, top szolgáltatók, tételek.

### Tranzakció rögzítése (Pénzügyek + gomb)
Egyetlen bottom sheet (max 96% magas, görgethető):
1. Típus váltó: Kiadás / Bevétel / Átutalás + ✕.
2. „Legutóbbi · egy koppintás” chipek (csak üres állapotban) → kitölt hely + kategória + tárca + összeg.
3. Összeg (46px heading, előjellel). Koppintás → billentyűzet vissza.
4. Összecsukható sorok (egyszerre egy nyitva; nyitáskor a billentyűzet eltűnik): **Dátum** (Ma/Tegnap/Más nap) · **Hol** (kereső + javaslatok „Kategória › Alkat · N×”; választás automatikusan kitölti a kategóriát és tárcát; új név felvehető) · **Kategória** (5 oszlopos ikonrács + alkategória chipek) · **Miből** (tárca chipek). Bevételnél „Kitől” / „Hová”; átutalásnál Honnan / Hová.
5. Billentyűzet 3×4 (1–9, 000, 0, ⌫), 46px pirulák.
6. Mentés gomb: „Mentés · −2 300 Ft”; csak az összeg kötelező.

### Állapotok
- Betöltés: helykitöltő blokkok surface színben (hero 150px, 2×84px, 2 szövegcsík, 220px).
- Hiba: accent-2-100 sáv „Nem sikerült szinkronizálni · Revolut · utolsó siker …” + „Újra”.
- Üres: illusztráció + rövid szöveg + akció.

## State Management (Pénzügyek)
`sub` (aktív aloldal), `menu`, `month` (sep/okt/nov), `filter`, `txSearch`, `txView` (list/cal), `calDay`, `flowSel`, `detail`, `panel` (split/recon/budget/import/cat/sub), `limits` (kategória→keret), `recon`, `impStep`, `impSkip`, `dismissed` (jelzések), rögzítés: `capType`, `capOpen`, `capDate`, `amount`, `merchant`, `cat`, `subcat`, `wallet`, `toWallet`, `added[]`. Mentett tétel azonnal frissíti: havi bevétel/kiadás, kategóriák, keretek, tárca-egyenlegek, tranzakciólista.

## Adatok
A prototípusban a képernyőképek valós adatai szerepelnek (tárcák, előfizetések, vagyonelemek, október 27–30. tételek). **Kitalált:** szeptemberi számok, októberi kategóriánkénti költés, 5 keret (Lakhatás, Étel, Vásárlás, Szórakozás, Sport), 6 havi kategória-trend, naptár napi összegek 27-e előtt, import előnézet 2 tétele, Spotify ártörténet. Ezeket a valódi Firestore adatokra kell kötni.

## Files
- `Sikerfüzet Navigáció.dc.html` – alsó sáv, Összes, modul fejléc + Hibrid fülsor, Rögzítés panel, illusztrációk (Tweaks: téma, font, fülsor, rögzítés, illusztráció)
- `Pénzügyek.dc.html` – a teljes Pénzügyek modul, 15 telefon (élő + aloldalak + al-képernyők)
- `Illu.dc.html` – illusztráció komponens
- `support.js`, `image-slot.js` – a prototípusok futtatásához
