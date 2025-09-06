// src/services/googleAuth.js
// Tiny wrapper around Google Identity Services OAuth 2.0 token client.

let tokenClient = null;
let accessToken = null;
let expiresAt = 0;
let currentClientId = null;

// Scopes we need: full Drive (works with any folder) + Gmail send
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export function initGoogleAuth(clientId) {
  currentClientId = clientId;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    // We’ll set the callback just-in-time in requestAccess()
    callback: () => {},
  });
}

function now() {
  return Math.floor(Date.now() / 1000);
}

export async function requestAccess({ prompt = "consent" } = {}) {
  if (!tokenClient) throw new Error("Google auth not initialized");

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(resp);
      // GIS puts token on google.accounts.oauth2, but also returns access_token on resp
      accessToken = resp.access_token || google?.accounts?.oauth2?.token?.access_token || null;
      const expiresIn = Number(resp.expires_in || 3600);
      expiresAt = now() + expiresIn - 30; // refresh a little early
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt }); // "consent" first time, "none" for silent
  });
}

export async function getAccessToken() {
  // valid cached?
  if (accessToken && now() < expiresAt) return accessToken;
  // try silent refresh
  try {
    return await requestAccess({ prompt: "" });
  } catch (e) {
    // fall back to interactive
    return await requestAccess({ prompt: "consent" });
  }
}

export function signOut() {
  accessToken = null;
  expiresAt = 0;
  // There’s no revoke for GIS token client here; clearing is enough for our use.
}

export function getClientId() {
  return currentClientId;
}
