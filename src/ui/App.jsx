// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getFolderMeta, createFile } from "../services/drive";
import { initGoogleAuth, signInInteractive, getAccessTokenSync } from "../services/googleAuth";

const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
  invoiceNo: "inv_web_invoice_no",
};

function pad2(n) { return String(n).padStart(2, "0"); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function plusDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function App() {
  // Settings
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [status, setStatus] = useState("Idle");

  // Auth state (simple)
  const [authed, setAuthed] = useState(false);

  // Invoice fields (minimal)
  const [invoiceNo, setInvoiceNo] = useState(() => {
    const saved = localStorage.getItem(LS_KEYS.invoiceNo);
    return saved ? Number(saved) : 25;
  });
  const [overrideNo, setOverrideNo] = useState(false);

  const [contact, setContact] = useState({ name: "", address1: "", address2: "", cityzip: "" });
  const [date, setDate] = useState(todayISO());
  const dueDate = useMemo(() => plusDaysISO(15), []);

  // -------------------------------
  // B) Initialize Google auth when clientId changes
  // -------------------------------
  useEffect(() => {
    if (!clientId) return;
    try {
      initGoogleAuth(clientId);
      setStatus("Auth ready");
    } catch (e) {
      console.error(e);
      setStatus("Auth init error");
    }
  }, [clientId]);

  function saveSettings() {
    localStorage.setItem(LS_KEYS.clientId, clientId);
    localStorage.setItem(LS_KEYS.folderId, folderId);
    setStatus("Settings saved");
  }

  async function handleSignIn() {
    try {
      await signInInteractive(); // opens Google consent; stores token
      setAuthed(true);
      setStatus("Signed in");
    } catch (e) {
      console.error(e);
      setAuthed(false);
      setStatus("Auth error");
      alert(e.message || "Sign in failed");
    }
  }

  async function handleSaveToDrive() {
    // Ensure token present
    if (!getAccessTokenSync()) {
      setStatus("Please sign in first");
      alert("Click 'Sign in with Google' and approve access.");
      return;
    }
    if (!folderId) {
      setStatus("Missing Drive folder ID");
      alert("Please enter a valid Drive folder ID and Save settings.");
      return;
    }

    setStatus("Checking folder…");
    try {
      await getFolderMeta(folderId);
    } catch (e) {
      console.error(e);
      setStatus("Cannot access folder");
      alert("Cannot access target folder. Check the ID (and that you’re signed in with the account that owns the folder).");
      return;
    }

    // Build a simple invoice payload
    const payload = {
      contact,
      invoiceNo,
      date,
      dueDate,
      total: 0,
      generatedAt: new Date().toISOString(),
    };

    setStatus("Saving to Drive…");
    try {
      const safeName = `invoice_${invoiceNo}_${date}.json`;
      await createFile({
        folderId,
        name: safeName,
        mimeType: "application/json",
        data: JSON.stringify(payload, null, 2),
      });

      // Increment invoice number (unless user is overriding)
      if (!overrideNo) {
        const next = Number(invoiceNo) + 1;
        setInvoiceNo(next);
        localStorage.setItem(LS_KEYS.invoiceNo, String(next));
      }
      setStatus("Saved to Drive ✓");
      alert(`Saved to Drive as ${safeName}`);
    } catch (e) {
      console.error(e);
      setStatus("Save failed");
      alert(e.message || "Save failed");
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>InvoiceGen Web</h1>

      {/* SETTINGS */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Settings</h2>

        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
          <label>Google OAuth Client ID</label>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ padding: 8 }} />

          <label>Drive Folder ID</label>
          <input value={folderId} onChange={(e) => setFolderId(e.target.value)} style={{ padding: 8 }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={saveSettings}>Save settings</button>
          <button onClick={handleSignIn}>Sign in with Google</button>
          <span style={{ marginLeft: 8, color: "#666" }}>Status: {status}{authed ? " (authed)" : ""}</span>
        </div>
      </section>

      {/* INVOICE */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Invoice</h2>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
          <label>Name</label>
          <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} style={{ padding: 8 }} />

          <label>Address line 1</label>
          <input value={contact.address1} onChange={(e) => setContact({ ...contact, address1: e.target.value })} style={{ padding: 8 }} />

          <label>Address line 2</label>
          <input value={contact.address2} onChange={(e) => setContact({ ...contact, address2: e.target.value })} style={{ padding: 8 }} />

          <label>City/Zip</label>
          <input value={contact.cityzip} onChange={(e) => setContact({ ...contact, cityzip: e.target.value })} style={{ padding: 8 }} />

          <label>Invoice #</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(Number(e.target.value))}
              disabled={!overrideNo}
              style={{ padding: 8, width: 140, background: overrideNo ? "white" : "#f3f3f3" }}
            />
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={overrideNo} onChange={(e) => setOverrideNo(e.target.checked)} />
              Override invoice number
            </label>
          </div>

          <label>Invoice date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 8, width: 180 }} />
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>Due date (+15d by default) <strong>{dueDate}</strong></div>

        <div style={{ marginTop: 12 }}>
          <button onClick={handleSaveToDrive}>Save (saves to Drive & increments)</button>
        </div>
      </section>

      {/* PREVIEW */}
      <section style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Preview (lightweight)</h3>
        <div>{new Date(date).toLocaleDateString()} → due {new Date(dueDate).toLocaleDateString()}</div>
        <div style={{ marginTop: 6 }}>Invoice #{invoiceNo}</div>
      </section>
    </div>
  );
}
