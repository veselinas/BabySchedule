/* ============================================================
   config.js
   All "knobs" for the app live here. Edit freely.
   ============================================================ */

// --- Azure AD app registration -------------------------------------------
// Create an "App registration" in the Azure Portal (Microsoft Entra ID),
// type: "Single-page application", and put the redirect URI equal to the
// URL you'll host this app at (e.g. https://yourname.github.io/baby-tracker/).
// Paste the "Application (client) ID" below. This value is not secret
// for a SPA/public client, but keep the app registration itself locked
// down to only the permissions listed below.
window.APP_CONFIG = {
  CLIENT_ID: "YOUR_AZURE_CLIENT_ID_HERE", // <-- REQUIRED: paste your client ID
  AUTHORITY: "https://login.microsoftonline.com/consumers", // personal Microsoft/OneDrive accounts
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPES: ["Files.ReadWrite", "User.Read"],
  ONEDRIVE_FOLDER: "App_BabySchedule",
  // Set to true to use the browser's localStorage instead of OneDrive.
  // Handy for trying the app out before Azure is set up, or for offline use.
  // Flip to false once CLIENT_ID above is filled in and you want real sync.
  USE_LOCAL_STORAGE_ONLY: true
};

// --- Controlled vocabularies (used across blocks) -------------------------
window.RATING_OPTIONS = ["no", "poor", "average", "excellent"];

window.MOOD_OPTIONS = [
  "happy", "sad", "guilty", "angry", "disappointed",
  "excited", "energetic", "calm", "frustrated", "proud"
];

window.SLEEP_TYPES = ["night", "nap"];
window.SLEEP_LOCATIONS = ["cot", "contact nap", "pram", "car seat", "carrier"];

window.MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
window.MEAL_ITEM_RATING_OPTIONS = ["not accepted", "neutral", "accepted"];
window.MEAL_ITEM_REACTION_OPTIONS = ["no", "ambiguous", "severe", "rash", "itching", "reflux"];
