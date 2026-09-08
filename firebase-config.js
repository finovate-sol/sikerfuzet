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

// Igaz, ha már valós config van beállítva (nem placeholder).
export const isConfigured = !String(firebaseConfig.apiKey).includes("PLACEHOLDER");
