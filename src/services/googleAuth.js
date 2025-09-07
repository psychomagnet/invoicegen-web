// src/services/googleAuth.js
let tokenClient = null;
let accessToken = null;
let expiresAt = 0;

const SCOPES = [
  // Use full Drive so we can read an arbitrary folder by ID and upload into it
  "https://www.googleapis.com/auth/drive",
  // For future email sending
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const now = () => Math.floor(Date.now() / 1000);

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

export function signInInteractive() {
  if (!tokenClient) throw new Error("Google auth not initialized");
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      accessToken = resp.access_token;
      const seconds = Number(resp.expires_in || 3600);
      expiresAt = now() + seconds - 30;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function getAccessTokenSync() {
  if (accessToken && now() < expiresAt) return accessToken;
  return null;
}
