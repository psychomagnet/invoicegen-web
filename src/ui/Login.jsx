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
    // Only initialize once we have a clientId typed/pasted
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
      // persist settings
      localStorage.setItem(LS_KEYS.clientId, clientId.trim());
      localStorage.setItem(LS_KEYS.folderId, folderId.trim());
      setStatus("Signed in");
      onAuthed({ clientId: clientId.trim(), folderId: folderId.trim() });
    } catch (e) {
      setStatus(`Sign-in error: ${e.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow p-6 space-y-5">
        <h1 className="text-2xl font-semibold">InvoiceGen Web · Sign in</h1>
        <p className="text-sm text-neutral-600">
          Paste your <span className="font-medium">Google OAuth Client ID</span> and the
          <span className="font-medium"> Drive Folder ID</span> for saving invoices. You’ll only do this once; we’ll remember them locally.
        </p>
        <label className="text-sm block">
          Google OAuth Client ID
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </label>
        <label className="text-sm block">
          Drive Folder ID
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Drive folder ID (the long string in the URL)"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-600">Status: {status}</div>
          <button
            className="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={!clientId || !folderId}
            onClick={handleSignIn}
          >
            Sign in with Google
          </button>
        </div>
        <div className="text-xs text-neutral-500">
          Tip: make sure your OAuth “Authorized JavaScript origins” includes this site and localhost (during dev).
        </div>
      </div>
    </div>
  );
}
