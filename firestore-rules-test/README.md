# Firestore-szabályok tesztje

A `../firestore.rules` fájlt ellenőrzi a Firestore emulátoron – valódi
lekérdezésekkel, nem elméletben. Ha a szabályokon módosítasz, ezt futtasd le.

```bash
npm install
npm run emulator      # egyik terminálban (Java kell hozzá)
npm test              # a másikban
```

A teszt lefedi: a belépés-vezérlést (allowlist), a felettes-láncot több szinten
át, a személyes adatok elzárását, a csapatszintű ügyféllistát, a PG-jegyzet
vezetői zártságát, és azt, hogy a munkatárs a rá bízott akcióterv szövegét nem
írhatja át, csak a státuszát.

Fontos, amit ellenőriz: a `pg` és a `pg_akcio` kollekcióból **szűretlen**
listázás tiltott. Ezért olvas az `auth.js` (`getPGs`, `getAkciok`) szűrt
lekérdezéssel – ha ezt visszaalakítanád teljes listázásra, az app elhasalna.
