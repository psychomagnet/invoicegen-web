// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from "react";

// Drive helpers (already updated to support Shared drives)
import drive, {
  getFolderMeta,
  createFile,
  listFiles,
  driveGetFolderMeta,
  driveCreateFile,
  driveListFiles,
} from "../services/drive";

// Google auth helpers (new)
import {
  initGoogleAuth,
  signInInteractive,
  getAccessTokenSync,
} from "../services/googleAuth";


const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
};

export default function App() {
  // Settings
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [status, setStatus] = useState("Idle");
  const [authed, setAuthed] = useState(false);

  // Invoice UI (minimal preview)
  const [invoiceNo, setInvoiceNo] = useState(25);
  const [overrideNo, setOverrideNo] = useState(false);
  const [contact, setContact] = useState({ name: "", address1: "", address2: "", cityzip: "" });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const dueDate = useMemo(() => {
    const d = new Date(date);
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  }, [date]);

  // Debug: show what drive exports look like
  console.log("Drive module keys:", Object.keys(drive || {}));
  console.log("Named exports present:", {
    getFolderMeta: typeof getFolderMeta,
    createFile: typeof createFile,
    listFiles: typeof listFiles,
    driveGetFolderMeta: typeof driveGetFolderMeta,
    driveCreateFile: typeof driveCreateFile,
    driveListFiles: typeof driveListFiles,
  });

  useEffect(() => {
    // If GIS loaded and we have a clientId, initialize
    if (window.google && clientId) {
      try {
        initGoogleAuth(clientId);
      } catch (e) {
        console.error("initGoogleAuth error", e);
      }
    }
  }, [clientId]);

  function persistSettings() {
    localStorage.setItem(LS_KEYS.clientId, clientId);
    localStorage.setItem(LS_KEYS.folderId, folderId);
  }

  async function handleSignIn() {
    try {
      persistSettings();
      if (!window.google) throw new Error("Google Identity script not loaded");
      if (!clientId) throw new Error("Enter your Google OAuth Client ID first");
      initGoogleAuth(clientId);
      setStatus("Requesting access…");
      await requestAccess({ prompt: "consent" });
      setAuthed(true);
      setStatus("Signed in");
    } catch (e) {
      console.error(e);
      alert(e.message || "Sign-in failed");
      setStatus("Auth error");
    }
  }

  function handleSignOut() {
    googleSignOut();
    setAuthed(false);
    setStatus("Signed out");
  }

  async function handleSave() {
    try {
      persistSettings();
      setStatus("Checking folder…");
      const token = await getAccessToken(); // silent refresh if possible
      setAuthed(true);

      // sanity check folder exists and is reachable
      const meta = await getFolderMeta(token, folderId);
      console.log("Folder meta:", meta);

      // Here you would generate and upload the files; for now we only validate auth/folder.
      setStatus("Ready (folder reachable)");
      alert("Drive folder reachable. (This confirms auth + folder ID are good.)");
    } catch (err) {
      console.error("Drive error:", err);
      setStatus("Error");
      // Surface the server error body if present
      try {
        const parsed = JSON.parse(
          ("" + err.message).replace(/^.*\{/, "{") // crude extract if message wrapped text
        );
        alert(JSON.stringify(parsed, null, 2));
      } catch {
        alert(err.message || "Unknown error");
      }
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1>InvoiceGen Web</h1>

      <section style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h3>Settings</h3>
        <div style={{ marginBottom: 8 }}>
          <label>Google OAuth Client ID</label>
          <input
            style={{ width: "100%" }}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="your-client-id.apps.googleusercontent.com"
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Drive Folder ID</label>
          <input
            style={{ width: "100%" }}
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="Folder ID from your Drive URL"
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button onClick={persistSettings}>Save settings</button>
          {!authed ? (
            <button onClick={handleSignIn}>Sign in with Google</button>
          ) : (
            <button onClick={handleSignOut}>Sign out</button>
          )}
          <span style={{ fontSize: 12, color: "#555" }}>Status: {status}</span>
        </div>

        <button onClick={handleSave}>Save (saves to Drive & increments)</button>
      </section>

      <section style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h3>Invoice</h3>
        <div>
          <label>Name</label>
          <input
            style={{ width: "100%" }}
            value={contact.name}
            onChange={(e) => setContact({ ...contact, name: e.target.value })}
          />
        </div>
        <div>
          <label>Address line 1</label>
          <input
            style={{ width: "100%" }}
            value={contact.address1}
            onChange={(e) => setContact({ ...contact, address1: e.target.value })}
          />
        </div>
        <div>
          <label>Address line 2</label>
          <input
            style={{ width: "100%" }}
            value={contact.address2}
            onChange={(e) => setContact({ ...contact, address2: e.target.value })}
          />
        </div>
        <div>
          <label>City/Zip</label>
          <input
            style={{ width: "100%" }}
            value={contact.cityzip}
            onChange={(e) => setContact({ ...contact, cityzip: e.target.value })}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Invoice #</label>{" "}
          <input
            disabled={!overrideNo}
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            style={{ width: 100 }}
          />
          <label style={{ marginLeft: 8 }}>
            <input
              type="checkbox"
              checked={overrideNo}
              onChange={(e) => setOverrideNo(e.target.checked)}
            />
            {" "}Override invoice number
          </label>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Invoice date</label>{" "}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>
            Due date (+15d): {dueDate}
          </span>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
        <h3>Preview (lightweight)</h3>
        <p>
          {new Date(date).toLocaleDateString()} → due {new Date(dueDate).toLocaleDateString()}
        </p>
        <p>Invoice #{invoiceNo}</p>
        <p>{contact.name}</p>
        <p>{contact.address1}</p>
        <p>{contact.cityzip}</p>
      </section>
    </div>
  );
}
