// src/services/googleAuth.js

let tokenClient = null;
let accessToken = null;
let expireAt = 0;

// Use Drive (only files you create/open with the app) + Gmail send
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send"
].join(" ");

// Return seconds since epoch
const now = () => Math.floor(Date.now() / 1000);

/**
 * Initialize Google OAuth client with your Client ID
 */
export function initGoogleAuth(clientId) {
  if (!window.google?.accounts?.oauth2) {
    throw new Error(
      'Google Identity script not loaded. Add <script src="https://accounts.google.com/gsi/client" async defer></script> into <head>.'
    );
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {}, // set per request
  });
}

/**
 * Interactive sign-in (popup consent)
 */
export function signInInteractive() {
  if (!tokenClient) throw new Error("Google auth not initialized");

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      accessToken = resp.access_token;
      expireAt = now() + resp.expires_in;
      resolve(accessToken);
    };

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/**
 * Silent token fetch (if not expired)
 */
export async function getAccessToken() {
  if (accessToken && expireAt > now() + 60) {
    return accessToken;
  }

  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject("Google auth not initialized");

    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      accessToken = resp.access_token;
      expireAt = now() + resp.expires_in;
      resolve(accessToken);
    };

    tokenClient.requestAccessToken({ prompt: "" }); // silent if possible
  });
}

/**
 * Request access wrapper (used in App.jsx)
 */
export async function requestAccess() {
  return signInInteractive();
}

/**
 * Sign out (clear local token only, user stays logged into Google)
 */
export function signOut() {
  accessToken = null;
  expireAt = 0;
}
