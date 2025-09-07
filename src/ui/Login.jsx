import React, { useEffect, useState } from "react";
import { initGoogleAuth, signInInteractive } from "../services/googleAuth";

const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
};

export default function Login({ onAuthed }) {
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    if (!clientId) return;
    try {
      initGoogleAuth(clientId);
      setStatus("Ready to sign in");
    } catch (e) {
      setStatus(`Init error: ${e.message}`);
    }
  }, [clientId]);

  async function handleSignIn() {
    try {
      setStatus("Signing in…");
      await signInInteractive();
      localStorage.setItem(LS_KEYS.clientId, clientId.trim());
      localStorage.setItem(LS_KEYS.folderId, folderId.trim());
      setStatus("Signed in");
      onAuthed({ clientId: clientId.trim(), folderId: folderId.trim() });
    } catch (e) {
      setStatus(`Sign-in error: ${e.message}`);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-title">InvoiceGen Web · Sign in</div>
        <div className="help">
          Paste your <b>Google OAuth Client ID</b> and the <b>Drive Folder ID</b> for saving
          invoices. You’ll only do this once; we remember them locally.
        </div>

        <div className="field">
          <label>Google OAuth Client ID</label>
          <input
            className="input"
            placeholder="xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Drive Folder ID</label>
          <input
            className="input"
            placeholder="Drive folder ID (the long string in the URL)"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div className="help">Status: {status}</div>
          <button className="btn btn-primary" disabled={!clientId || !folderId} onClick={handleSignIn}>
            Sign in with Google
          </button>
        </div>

        <div className="help">
          Tip: make sure your OAuth “Authorized JavaScript origins” include this site and localhost (during dev).
        </div>
      </div>
    </div>
  );
}
