// ============================================================================
//  FIREBASE KONFIGURÁCIÓ
//  Cseréld ki az alábbi placeholder értékeket a saját Firebase projekted
//  configjára: Firebase Console → Project settings (⚙️) → General →
//  "Your apps" → Web app → firebaseConfig.
//  Ezek az értékek PUBLIKUSAK, nyugodtan bekerülhetnek a repóba.
// ============================================================================
export const firebaseConfig = {
    apiKey: "PLACEHOLDER_API_KEY",
    authDomain: "PLACEHOLDER.firebaseapp.com",
    projectId: "PLACEHOLDER_PROJECT_ID",
    storageBucket: "PLACEHOLDER.appspot.com",
    messagingSenderId: "PLACEHOLDER_SENDER_ID",
    appId: "PLACEHOLDER_APP_ID"
};

// Igaz, ha már valós config van beállítva (nem placeholder).
export const isConfigured = !String(firebaseConfig.apiKey).includes("PLACEHOLDER");
