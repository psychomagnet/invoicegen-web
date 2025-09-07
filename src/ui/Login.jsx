import React, { useEffect, useState } from "react";
import { initGoogleAuth, requestAccess, getAccessToken } from "../services/googleAuth";

const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
};

export default function Login({ onAuthed }) {
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // If both are already present and we have a token, skip straight in
  useEffect(() => {
    try {
      if (clientId) initGoogleAuth(clientId);
      if (clientId && folderId && getAccessToken()) {
        onAuthed?.({ clientId, folderId });
      }
    } catch {
      /* ignore until user submits */
    }
  }, []); // run once

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!clientId || !folderId) {
      setError("Please enter both Client ID and Drive Folder ID.");
      return;
    }
    try {
      setBusy(true);
      // Initialize the Google Identity client with the provided Client ID
      initGoogleAuth(clientId);

      // Ask user to grant Drive access
      await requestAccess();

      // Persist settings locally
      localStorage.setItem(LS_KEYS.clientId, clientId);
      localStorage.setItem(LS_KEYS.folderId, folderId);

      onAuthed?.({ clientId, folderId });
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>InvoiceGen Web</h1>
        <p className="muted">Sign in with Google to continue</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="label">Google OAuth Client ID</label>
          <input
            className="input"
            placeholder="YOUR_CLIENT_ID.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value.trim())}
          />

          <label className="label">Drive Folder ID</label>
          <input
            className="input"
            placeholder="Drive folder ID (the long string in the URL)"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value.trim())}
          />

          {error && <div className="error">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Save & Sign in"}
          </button>
        </form>

        <div className="footnote">
          We request Google Drive access to save invoices in your chosen folder.
        </div>
      </div>
    </div>
  );
}
