let tokenClient;
let accessToken = null;

export function initGoogleAuth(clientId, onToken) {
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    console.error("Google Identity Services SDK not loaded. Did you add the <script> tag?");
    return;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send",
    callback: (response) => {
      if (response.error) {
        console.error("Auth error", response);
        return;
      }
      accessToken = response.access_token;
      console.log("Got access token:", accessToken);
      if (onToken) onToken(accessToken);
    },
  });
}

export function signIn() {
  if (!tokenClient) {
    console.error("Google Auth not initialized");
    return;
  }
  tokenClient.requestAccessToken({ prompt: "consent" });
}

export function getAccessToken() {
  return accessToken;
}
