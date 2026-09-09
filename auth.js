// ============================================================================
//  AUTH MODUL – Google-belépés + email-allowlist (Firebase)
//  Közös modul a login.html és az index.html számára.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, serverTimestamp
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

let app, auth, db;
if (isConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}
export { auth, db };

// --- Segéd: benne van-e az email az allowlistben? ---
async function isEmailAllowed(email) {
    if (!email) return false;
    try {
        const snap = await getDoc(doc(db, ALLOWLIST, email.toLowerCase()));
        return snap.exists();
    } catch (e) {
        console.error("Allowlist ellenőrzés sikertelen:", e);
        return false;
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

    // A munkatárs profil létrehozása/frissítése (első belépéskor is).
    try {
        await setDoc(doc(db, "employees", result.user.uid), {
            email: email,
            name: result.user.displayName || "",
            photoURL: result.user.photoURL || "",
            lastLogin: serverTimestamp()
        }, { merge: true });
    } catch (e) { console.warn("Profil mentés kihagyva:", e); }

    return result.user;
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
        const allowed = await isEmailAllowed(user.email);
        if (!allowed) { await signOut(auth); window.location.replace("login.html?denied=1"); return; }
        if (onReady) onReady(user);
    });
}

// --- Login oldalon: ha már be van lépve és engedélyezett, tovább a dashboardra ---
export function redirectIfLoggedIn() {
    if (!isConfigured || !auth) return;
    onAuthStateChanged(auth, async (user) => {
        if (user && await isEmailAllowed(user.email)) {
            window.location.replace("index.html");
        }
    });
}
