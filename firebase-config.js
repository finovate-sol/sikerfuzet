// ============================================================================
//  FIREBASE KONFIGURÁCIÓ
//  A finovate-sol-sikerfuzet Firebase projekt web-configja.
//  Ezek az értékek PUBLIKUSAK (kliensoldali azonosítók) – nyugodtan a repóban.
// ============================================================================
export const firebaseConfig = {
    apiKey: "AIzaSyDeZxEJpjZlzUBOboPpUzHZxPmMgk7L6vU",
    authDomain: "finovate-sol-sikerfuzet.firebaseapp.com",
    projectId: "finovate-sol-sikerfuzet",
    storageBucket: "finovate-sol-sikerfuzet.firebasestorage.app",
    messagingSenderId: "494203637099",
    appId: "1:494203637099:web:760b7b8a859a3948d0902e",
    measurementId: "G-K9JQXBSPE4"
};

// ----------------------------------------------------------------------------
//  GOOGLE OAUTH CLIENT ID (a néma, automatikus naptár-csatlakozáshoz)
//  Ha üresen marad, minden a régi módon működik: a naptár a "Csatlakoztatás"
//  gombbal kapcsolható be. Kitöltve az app induláskor csendben kér egy friss
//  hozzáférést, ha azt a Google-fiók már egyszer engedélyezte.
//
//  Honnan: Google Cloud Console → APIs & Services → Credentials →
//  "Web client (auto created by Google Service)" → Client ID.
//  Ugyanott az "Authorized JavaScript origins" közé fel kell venni azt az
//  origint is, ahonnan az app fut: https://finovate-sol.github.io
//  Ez az azonosító is PUBLIKUS, nyugodtan maradhat a repóban.
// ----------------------------------------------------------------------------
export const googleClientId = "";

// Igaz, ha már valós config van beállítva (nem placeholder).
export const isConfigured = !String(firebaseConfig.apiKey).includes("PLACEHOLDER");
