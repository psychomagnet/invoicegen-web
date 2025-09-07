// src/services/googleAuth.js
let tokenClient = null;
let accessToken = null;
let expiresAt = 0; // unix seconds

// We need full Drive since we read by folderId and upload later
const SCOPES = "https://www.googleapis.com/auth/drive";

const nowSec = () => Math.floor(Date.now() / 1000);

export function initGoogleAuth(clientId) {
  if (!window.google?.accounts?.oauth2) {
    throw new Error(
      'Google Identity script not loaded. Add <script src="https://accounts.google.com/gsi/client" async defer></script> to <head>.'
    );
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    prompt: "", // try silent first
    callback: (resp) => {
      if (resp?.error) return;
      accessToken = resp.access_token;
      // Add a small safety margin
      expiresAt = nowSec() + (resp.expires_in || 3600) - 60;
    },
  });
}

/**
 * Ensure we have a valid access token.
 * - If a fresh token exists, returns it.
 * - Otherwise requests a token. If `interactive` is false, attempts silent; if that fails, resolves only if interactive==true.
 */
export function ensureAccess({ interactive = true } = {}) {
  if (!tokenClient) throw new Error("Google auth not initialized");
  const now = nowSec();
  if (accessToken && now < expiresAt) return Promise.resolve(accessToken);

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp && !resp.error) {
        accessToken = resp.access_token;
        expiresAt = nowSec() + (resp.expires_in || 3600) - 60;
        resolve(accessToken);
      } else {
        reject(new Error(resp?.error || "Auth failed"));
      }
    };
    tokenClient.requestAccessToken({
      // If not interactive, try silent first; otherwise show the consent UI.
      prompt: interactive ? "consent" : "",
    });
  });
}

export function getAccessToken() {
  return accessToken;
}

export function signOut() {
  accessToken = null;
  expiresAt = 0;
  // (Optional) You can also revoke with google.accounts.oauth2.revoke if desired.
}
