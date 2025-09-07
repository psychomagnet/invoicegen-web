// src/ui/Login.jsx
import React, { useEffect, useState } from "react";
import { initGoogleAuth, ensureAccess, signOut } from "../services/googleAuth";

const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
};

export default function Login({ onAuthed }) {
  const [clientId, setClientId] = useState("");
  const [folderId, setFolderId] = useState("");
  const [status, setStatus] = useState("Idle");

  // Load saved settings and try silent auth if clientId exists
  useEffect(() => {
    const ci = localStorage.getItem(LS_KEYS.clientId) || "";
    const fi = localStorage.getItem(LS_KEYS.folderId) || "";
    setClientId(ci);
    setFolderId(fi);

    if (!ci) return;

    try {
      initGoogleAuth(ci);
      // Try silent token first (no popups). If it works, go straight in.
      ensureAccess({ interactive: false })
        .then(() => {
          setStatus("Signed in (silent)");
          onAuthed?.({ clientId: ci, folderId: fi });
        })
        .catch(() => {
          setStatus("Ready — click Sign in to continue");
        });
    } catch (e) {
      setStatus(e.message || "Google Identity script not loaded");
    }
  }, [onAuthed]);

  function saveSettings() {
    localStorage.setItem(LS_KEYS.clientId, clientId.trim());
    localStorage.setItem(LS_KEYS.folderId, folderId.trim());
    setStatus("Settings saved");
    // (Re)initialize token client if possible
    if (clientId.trim()) {
      try {
        initGoogleAuth(clientId.trim());
      } catch (e) {
        setStatus(e.message || "Init failed");
      }
    }
  }

  async function handleSignIn() {
    if (!clientId.trim()) {
      setStatus("Please enter your Google OAuth Client ID first");
      return;
    }
    try {
      initGoogleAuth(clientId.trim()); // safe to call more than once
      await ensureAccess({ interactive: true }); // shows Google consent if needed
      setStatus("Signed in");
      onAuthed?.({ clientId: clientId.trim(), folderId: folderId.trim() });
    } catch (e) {
      setStatus(e.message || "Sign in failed");
    }
  }

  function handleSignOut() {
    signOut();
    setStatus("Signed out");
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>InvoiceGen Web</h1>
        <p style={styles.sub}>Sign in with Google to continue</p>

        <label style={styles.label}>Google OAuth Client ID</label>
        <input
          style={styles.input}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
        />

        <label style={styles.label}>Drive Folder ID</label>
        <input
          style={styles.input}
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          placeholder="1AbCDeFgHiJkLmNoPqRsTuVwXyZ"
        />

        <div style={styles.row}>
          <button style={styles.secondary} onClick={saveSettings}>
            Save settings
          </button>
          <button style={styles.primary} onClick={handleSignIn}>
            Sign in with Google
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
          Status: {status}
        </div>

        <button style={styles.link} onClick={handleSignOut}>
          Sign out
        </button>

        <div style={styles.note}>
          <div>Make sure this script tag is in your <code>&lt;head&gt;</code>:</div>
          <code style={styles.code}>
            {'<script src="https://accounts.google.com/gsi/client" async defer></script>'}
          </code>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f6f7f9",
    padding: 24,
  },
  card: {
    width: 640,
    maxWidth: "100%",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    padding: 24,
  },
  title: { margin: 0, fontSize: 24 },
  sub: { margin: "6px 0 20px", color: "#666" },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontSize: 13, color: "#444" },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d9dee5",
    borderRadius: 10,
    outline: "none",
  },
  row: { display: "flex", gap: 8, marginTop: 16 },
  primary: {
    padding: "10px 14px",
    background: "#111827",
    color: "#fff",
    border: "1px solid #111827",
    borderRadius: 10,
    cursor: "pointer",
  },
  secondary: {
    padding: "10px 14px",
    background: "#fff",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    cursor: "pointer",
  },
  link: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#6b7280",
    textDecoration: "underline",
    cursor: "pointer",
  },
  note: {
    marginTop: 18,
    paddingTop: 12,
    borderTop: "1px dashed #e5e7eb",
    fontSize: 12,
    color: "#6b7280",
  },
  code: {
    display: "block",
    marginTop: 6,
    padding: "8px 10px",
    background: "#f3f4f6",
    borderRadius: 8,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
};
