// ============================================================================
//  AUTH MODUL – Google-belépés + email-allowlist (Firebase)
//  Közös modul a login.html és az index.html számára.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
    initializeFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, isConfigured } from "./firebase-config.js";

export { isConfigured };

// A naptárhoz szükséges jogosultság: események olvasása ÉS létrehozása.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
// A PG modulhoz: Google Tasks (feladatlisták olvasása/írása).
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
// Ebbe a kollekcióba kerülnek a belépni jogosult emailek (doc-id = email).
const ALLOWLIST = "allowed_users";
// Admin (info-időpontok beállítása)
const ADMIN_EMAIL = "szecsimark@gmail.com";
export function isAdmin(user){ return !!user && String(user.email||"").toLowerCase() === ADMIN_EMAIL; }

// Megosztott app-konfiguráció (config/app dokumentum)
export async function getAppConfig(){
    if(!isConfigured || !db) return {};
    try { const snap = await getDoc(doc(db, "config", "app")); return snap.exists() ? (snap.data() || {}) : {}; }
    catch(e){ console.warn("config olvasás sikertelen:", e); return {}; }
}
export async function saveInfoDates(dates){
    return saveAppConfig({ infoDates: dates });
}
export async function saveAppConfig(obj){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "config", "app"), obj, { merge: true });
}

export async function getAllowedUsers(){
    if(!isConfigured || !db) return [];
    try {
        const snap = await getDocs(collection(db, ALLOWLIST));
        return snap.docs.map(d => d.id);
    } catch(e){ console.error("Felhasználók olvasása sikertelen:", e); return []; }
}
export async function addAllowedUser(email){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, ALLOWLIST, email.toLowerCase().trim()), { added: serverTimestamp() });
}
export async function removeAllowedUser(email){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await deleteDoc(doc(db, ALLOWLIST, email.toLowerCase().trim()));
}

// Személyes (nem megosztott) struktúra-rajz – structures/{uid} dokumentum.
// Mindenkinek a saját fiókjához tartozik; vezetői "ránézés" esetén a
// megtekintett munkatárs uid-jával dolgozik az index.html.
export async function getStructure(uid){
    if(!isConfigured || !db || !uid) return null;
    try { const snap = await getDoc(doc(db, "structures", uid)); return snap.exists() ? (snap.data().tree || null) : null; }
    catch(e){ console.warn("Struktúra olvasás sikertelen:", e); return null; }
}
export async function saveStructure(uid, tree){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "structures", uid), { tree });
}

// Személyes "Karrier-létra" adatok (dátumok + teljesített szintek) –
// karrier_letra/{uid} dokumentum. Ugyanúgy személyes, mint a Struktúra-rajz,
// és korábban CSAK localStorage-ban élt egy közös (nem munkatárs-specifikus)
// kulcs alatt, ami megosztott gépen/böngészőben munkatársak között összekeveredett.
export async function getKarrierLetra(uid){
    if(!isConfigured || !db || !uid) return null;
    try { const snap = await getDoc(doc(db, "karrier_letra", uid)); return snap.exists() ? (snap.data() || null) : null; }
    catch(e){ console.warn("Karrier-létra olvasása sikertelen:", e); return null; }
}
export async function saveKarrierLetra(uid, data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "karrier_letra", uid), data);
}

// Megosztott "Ki lesz a következő" adatok, negyedévenként – kov_quarters/{year}_Q{q}
export async function getKovQuarter(key){
    if(!isConfigured || !db) return null;
    try { const snap = await getDoc(doc(db, "kov_quarters", key)); return snap.exists() ? (snap.data() || null) : null; }
    catch(e){ console.warn("Ki lesz következő olvasás sikertelen:", e); return null; }
}
export async function saveKovQuarter(key, data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "kov_quarters", key), data, { merge: true });
}

// Munkatársak napi/heti tevékenység-számlálói (pl. "10 perces füzet", "2 órás füzet")
// – így a vezető is láthatja, ki mennyi időt töltött el ténylegesen a füzettel.
export async function saveActivityTimer(key, data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "activity_timers", key), data, { merge: true });
}

// Megosztott csapat-ügyféllista – collection "clients". Minden dokumentum egy
// ügyfél; a munkatárs csak a saját (ownerUid) ügyfeleit látja, a vezető/admin
// mindet – ezt a szűrést az index.html végzi a lekért teljes listán.
export async function getClients(){
    if(!isConfigured || !db) return [];
    try {
        const snap = await getDocs(collection(db, "clients"));
        return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    } catch(e){ console.warn("Ügyféllista olvasása sikertelen:", e); return []; }
}
export async function addClient(data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    const ref = await addDoc(collection(db, "clients"), data);
    return ref.id;
}
export async function saveClient(id, data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "clients", id), data, { merge: true });
}
export async function deleteClient(id){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await deleteDoc(doc(db, "clients", id));
}

// Megosztott hozzáférés-térkép: ki kinek a beosztottja, hozzáférés-vezérlés
// szempontjából – az Admin "Hozzáférés" fülén állítható be, teljesen
// függetlenül a Struktúra (org-chart) rajztól, ami mostantól csak egy
// vizuális tervező modul. Alak: config/access dokumentum = { [uid]: "felettes uid" }
// (hiányzó kulcs / üres string = nincs felettese).
export async function getAccessMap(){
    if(!isConfigured || !db) return {};
    try { const snap = await getDoc(doc(db, "config", "access")); return snap.exists() ? (snap.data() || {}) : {}; }
    catch(e){ console.warn("Hozzáférés-térkép olvasása sikertelen:", e); return {}; }
}
export async function saveAccessMap(map){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "config", "access"), map);
}
// Egy uid összes láncolt (közvetlen + közvetett) beosztottja a hozzáférés-térkép alapján.
export function getSubordinateUids(uid, accessMap){
    const result = new Set();
    let changed = true;
    while(changed){
        changed = false;
        Object.keys(accessMap || {}).forEach(u => {
            if(result.has(u)) return;
            const mgr = accessMap[u];
            if(mgr && (mgr === uid || result.has(mgr))){ result.add(u); changed = true; }
        });
    }
    return result;
}
// Egy felhasználó akkor "vezető", ha a hozzáférés-térkép szerint van legalább
// egy (közvetlen vagy közvetett) beosztottja. Az admin mindig vezetőnek számít.
export function isLeaderByAccess(user, accessMap){
    if(!user) return false;
    if(isAdmin(user)) return true;
    if(!user.uid) return false;
    return getSubordinateUids(user.uid, accessMap).size > 0;
}

// Munkatárs saját Havi terve, hónaponként – havi_terv/{uid}_{year}_{month}.
// Vezető "ránézés" (view-as) esetén a megtekintett munkatárs uid-jával
// dolgozik az index.html, így ugyanazt az adatot látja/szerkesztheti.
export async function getHaviTerv(key){
    if(!isConfigured || !db) return null;
    try { const snap = await getDoc(doc(db, "havi_terv", key)); return snap.exists() ? (snap.data() || null) : null; }
    catch(e){ console.warn("Havi terv olvasása sikertelen:", e); return null; }
}
export async function saveHaviTerv(key, data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "havi_terv", key), data, { merge: true });
}
// Munkatárs saját Éves terve, évenként – eves_terv/{uid}_{year}
export async function getEvesTerv(key){
    if(!isConfigured || !db) return null;
    try { const snap = await getDoc(doc(db, "eves_terv", key)); return snap.exists() ? (snap.data() || null) : null; }
    catch(e){ console.warn("Éves terv olvasása sikertelen:", e); return null; }
}
export async function saveEvesTerv(key, data){
    if(!isConfigured || !db) throw new Error("A Firebase nincs beállítva.");
    await setDoc(doc(db, "eves_terv", key), data, { merge: true });
}

// Belépett munkatársak (employees/{uid}) – a loginWithGoogle() hozza létre/
// frissíti minden belépéskor. Az Admin "Csapat szerepkörök" fülének ez a
// forrása (valódi, bejelentkezett fiókok, névvel).
export async function getEmployees(){
    if(!isConfigured || !db) return [];
    try {
        const snap = await getDocs(collection(db, "employees"));
        return snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
    } catch(e){ console.warn("Munkatársak olvasása sikertelen:", e); return []; }
}

let app, auth, db;
if (isConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Néhány hálózat/hirdetésblokkoló megszakítja a Firestore alapértelmezett
    // streamelt (WebChannel) kapcsolatát ("RPC Write stream ... transport
    // errored"), ami miatt egy-egy felhasználónál csendben elhasalnak az
    // írások. Az automatikus long-polling DETEKTÁLÁS (experimentalAutoDetectLongPolling)
    // egy heurisztika, ami nem minden hálózat/blokkoló kombinációnál ismeri fel
    // helyesen, hogy long-pollingra váltson – ezért itt a biztosabb, mindig
    // long-pollingot használó módot kényszerítjük ki (kicsit nagyobb
    // késleltetés árán, de nem hasal el csendben az írás/olvasás).
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
}
export { auth, db };

// --- Segéd: benne van-e az email az allowlistben? ---
// FONTOS: egy átmeneti hálózati/kapcsolati hiba (pl. a Firestore streamelt
// kapcsolata megszakad – a konzolban "RPC Write/Listen stream ... transport
// errored" – lásd experimentalForceLongPolling fentebb, ez a hiba enélkül is
// jelentkezhet) NEM ugyanaz, mint amikor a dokumentum ténylegesen nem
// létezik. Korábban mindkettő "nincs hozzáférés" eredményt adott, ami egy
// pillanatnyi hálózati akadozásnál is kiléptette (és jogosulatlannak
// mutatta) az egyébként engedélyezett felhasználót. Most egy rövid
// újrapróbálkozás után is hiba esetén a hívó külön ("hálózati hiba") jelzést
// kap, nem hamis "nincs a listán" választ.
async function isEmailAllowed(email, attempt) {
    if (!email) return false;
    try {
        const snap = await getDoc(doc(db, ALLOWLIST, email.toLowerCase()));
        return snap.exists();
    } catch (e) {
        if (!attempt){
            await new Promise(r => setTimeout(r, 900));
            return isEmailAllowed(email, 1);
        }
        console.error("Allowlist ellenőrzés sikertelen (hálózati hiba):", e);
        const err = new Error("Nem sikerült ellenőrizni a hozzáférést a hálózati kapcsolat miatt. Próbáld újra.");
        err.isNetworkError = true;
        throw err;
    }
}

// --- Belépés Google-fiókkal (login oldalról hívva) ---
// Sikeres és engedélyezett belépés esetén a dashboardra irányít.
export async function loginWithGoogle() {
    if (!isConfigured) throw new Error("A Firebase még nincs beállítva (firebase-config.js).");

    // A bejelentkezés CSAK a naptár-jogot kéri – így akkor is működik,
    // ha a Google-projektben a Tasks API/scope még nincs engedélyezve.
    // A Tasks jogot a PG modul kéri külön (reconnectCalendar → incremental).
    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);
    provider.setCustomParameters({ prompt: "select_account" });

    const result = await signInWithPopup(auth, provider);
    const email = result.user.email;

    // Allowlist ellenőrzés – ha nincs benne, azonnal kiléptetjük.
    const allowed = await isEmailAllowed(email);
    if (!allowed) {
        await signOut(auth);
        throw new Error("Ehhez az e-mail címhez (" + email + ") nincs hozzáférés. Kérd az adminisztrátortól a felvételt.");
    }

    // A Google OAuth access token a Calendar API híváshoz (session-re eltesszük).
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
        try { sessionStorage.setItem("sf_gcal_token", credential.accessToken); } catch (e) {}
    }

    // A munkatárs profil létrehozása/frissítése – lásd ensureEmployeeProfile
    // lentebb: itt ÉS minden további oldalbetöltésnél (requireAuth) is fut,
    // hogy egy elakadt írás ne maradjon véglegesen elmentetlen.
    await ensureEmployeeProfile(result.user);

    return result.user;
}

// Munkatárs profil (employees/{uid}) létrehozása/frissítése. Ugyanaz a
// hálózati hiba (lásd isEmailAllowed fenti megjegyzése) korábban itt is
// előfordulhatott: a mentés csendben elmaradt, és mivel ez a hívás régen
// KIZÁRÓLAG a Google-popupos bejelentkezéskor futott le, egy meglévő
// munkamenettel visszatérő felhasználónál (requireAuth → onAuthStateChanged,
// nincs újabb popup) soha többé nem próbálkozott újra – az illető ettől
// függetlenül simán be tudott lépni és használni az appot, csak a profilja
// (és így pl. az Admin "Hozzáférés" listája) nem jött létre. Most egy rövid
// újrapróbálkozás után is hiba esetén csak figyelmeztet, nem dob hibát –
// ez az írás sosem akadályozhatja a bejelentkezést/appot.
async function ensureEmployeeProfile(user, attempt) {
    if (!user || !user.uid) return;
    try {
        await setDoc(doc(db, "employees", user.uid), {
            email: user.email || "",
            name: user.displayName || "",
            photoURL: user.photoURL || "",
            lastLogin: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        if (!attempt){
            await new Promise(r => setTimeout(r, 900));
            return ensureEmployeeProfile(user, 1);
        }
        console.warn("Munkatárs-profil mentés sikertelen (hálózati hiba), később újra próbálkozik:", e);
    }
}

// --- A session-re eltárolt Google naptár access token ---
export function getCalendarToken() {
    try { return sessionStorage.getItem("sf_gcal_token"); } catch (e) { return null; }
}

// --- Naptár újra-összekötése (friss access token kérése popup-pal) ---
export async function reconnectCalendar() {
    if (!isConfigured || !auth) throw new Error("A Firebase nincs beállítva.");
    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential && credential.accessToken;
    if (token) { try { sessionStorage.setItem("sf_gcal_token", token); } catch (e) {} }
    return token;
}

// --- PG modul: Google Tasks jog kérése (naptár + tasks, inkrementális) ---
// Külön a naptártól, hogy a naptár működjön akkor is, ha a Tasks API nincs
// engedélyezve. A visszakapott token a naptárra ÉS a Tasks-ra is érvényes.
export async function connectTasks() {
    if (!isConfigured || !auth) throw new Error("A Firebase nincs beállítva.");
    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);
    provider.addScope(TASKS_SCOPE);
    provider.setCustomParameters({ include_granted_scopes: "true" });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential && credential.accessToken;
    if (token) { try { sessionStorage.setItem("sf_gcal_token", token); } catch (e) {} }
    return token;
}

// --- Kilépés ---
export async function logout() {
    try { sessionStorage.removeItem("sf_gcal_token"); } catch (e) {}
    if (isConfigured && auth) await signOut(auth);
    window.location.href = "login.html";
}

// --- Védelem a dashboardon: nincs (engedélyezett) belépés → login oldal ---
// onReady(user) callback fut le, ha van érvényes, engedélyezett felhasználó.
export function requireAuth(onReady) {
    if (!isConfigured) {
        // Amíg a Firebase nincs beállítva, a demó szabadon nyitva marad.
        console.warn("Firebase nincs beállítva – a védelem inaktív (demó mód).");
        if (onReady) onReady(null);
        return;
    }
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.replace("login.html"); return; }
        let allowed;
        try { allowed = await isEmailAllowed(user.email); }
        catch (e) {
            // Hálózati hiba a jogosultság-ellenőrzésnél – ez NEM jelenti azt,
            // hogy nincs hozzáférés. Kiléptetés/redirect helyett egyszerű
            // újratöltés próbálja meg a kapcsolatot, az oldal a helyén marad.
            console.warn("Hozzáférés-ellenőrzés sikertelen (hálózati hiba), újratöltés próbálkozik:", e);
            setTimeout(() => window.location.reload(), 2000);
            return;
        }
        if (!allowed) { await signOut(auth); window.location.replace("login.html?denied=1"); return; }
        // Minden érvényes munkamenetnél (nemcsak a Google-popupos belépéskor)
        // – lásd ensureEmployeeProfile megjegyzését. Szándékosan nincs await
        // előtte: ne késleltesse az app betöltését, a hibáját már kezeli.
        ensureEmployeeProfile(user);
        if (onReady) onReady(user);
    });
}

// --- Login oldalon: ha már be van lépve és engedélyezett, tovább a dashboardra ---
export function redirectIfLoggedIn() {
    if (!isConfigured || !auth) return;
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try { if (await isEmailAllowed(user.email)) window.location.replace("index.html"); }
        catch (e) {
            // Hálózati hiba – maradjon a login oldalon, a gomb újra megnyomható.
            console.warn("Hozzáférés-ellenőrzés sikertelen (hálózati hiba):", e);
        }
    });
}
