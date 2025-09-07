// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  initGoogleAuth,
  requestAccess,
  getAccessToken,
  signOut as googleSignOut,
} from "../services/googleAuth";

// Minimal Drive helpers expected in ../services/drive
// - getFolderMeta(folderId)  -> verifies folder readable
// - listFiles(folderId, opts)-> returns array of {id,name,webViewLink,createdTime,mimeType,thumbnailLink,size}
// - createFile(folderId, name, mimeType, blob|Uint8Array) -> returns created file {id, name, webViewLink}
import { getFolderMeta, listFiles, createFile } from "../services/drive";

// We'll generate PDFs on the fly via dynamic import of jspdf (no bundler change needed)
let JSPDF = null;
async function getJsPDF() {
  if (!JSPDF) {
    const mod = await import("https://cdn.skypack.dev/jspdf@2.5.1");
    JSPDF = mod.jsPDF || mod.default;
  }
  return JSPDF;
}

// ---- Small helpers ---------------------------------------------------------
const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
  cc: "inv_web_cc",
  lastSeries: "inv_series_last", // numeric string
  lastYear: "inv_series_year",   // "25" for 2025
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear())}`;
};

const addDays = (isoLike, days = 15) => {
  const [dd, mm, yyyy] = isoLike.split("/").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const twoDigitYear = (d = new Date()) => String(d.getFullYear() % 100).padStart(2, "0");

// base64 url encoder (for Gmail raw RFC 2822)
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function driveFileViewLink(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}

// ---- Gmail: send message with PDF attachment -------------------------------
async function gmailSendWithAttachment({ to, cc, subject, html, attachmentBlob, attachmentName }) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  // Read blob as base64
  const pdfBytes = new Uint8Array(await attachmentBlob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
  const pdfBase64 = btoa(binary);

  const boundary = "invgen_boundary_" + Math.random().toString(36).slice(2);
  const nl = "\r\n";

  const message =
    `Content-Type: multipart/mixed; boundary="${boundary}"${nl}` +
    `MIME-Version: 1.0${nl}` +
    `to: ${to}${nl}` +
    (cc ? `cc: ${cc}${nl}` : "") +
    `subject: ${subject}${nl}${nl}` +
    `--${boundary}${nl}` +
    `Content-Type: text/html; charset="UTF-8"${nl}${nl}` +
    `${html}${nl}${nl}` +
    `--${boundary}${nl}` +
    `Content-Type: application/pdf; name="${attachmentName}"${nl}` +
    `Content-Disposition: attachment; filename="${attachmentName}"${nl}` +
    `Content-Transfer-Encoding: base64${nl}${nl}` +
    `${pdfBase64}${nl}` +
    `--${boundary}--`;

  const raw = base64UrlEncode(message);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${t}`);
  }
  return await res.json();
}

// ---- UI Component ----------------------------------------------------------
export default function App() {
  // Settings
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [ccEmail, setCcEmail] = useState(localStorage.getItem(LS_KEYS.cc) || "");
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState("Idle");

  // Invoice form
  const [contact, setContact] = useState({ name: "", addr1: "", addr2: "", cityzip: "" });
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [overrideNo, setOverrideNo] = useState(false);

  // Invoice number auto: "#<series>/<yy>"
  const [invoiceNo, setInvoiceNo] = useState(() => {
    const yy = twoDigitYear();
    const lastYear = localStorage.getItem(LS_KEYS.lastYear);
    const lastSeriesStr = localStorage.getItem(LS_KEYS.lastSeries);
    let nextSeries = 1;
    if (lastSeriesStr && lastYear === yy) {
      nextSeries = Number(lastSeriesStr || "0") + 1;
    }
    return `#${nextSeries}/${yy}`;
  });

  // Derived due date
  const dueDate = useMemo(() => addDays(invoiceDate, 15), [invoiceDate]);

  // History (from Drive)
  const [history, setHistory] = useState([]); // {id,name,webViewLink,createdTime}

  // Initialize Google auth when clientId changes
  useEffect(() => {
    if (!clientId) return;
    try {
      initGoogleAuth(clientId);
    } catch (e) {
      console.warn(e);
    }
  }, [clientId]);

  // After sign-in & when folderId changes: verify folder + load history
  useEffect(() => {
    if (!authed || !folderId) return;
    (async () => {
      try {
        setStatus("Checking Drive folder…");
        await getFolderMeta(folderId);
        setStatus("Loading history…");
        const files = await listFiles(folderId, { limit: 20 });
        setHistory(files || []);
        setStatus("Ready");
      } catch (e) {
        console.error(e);
        setStatus("Error: cannot access folder");
      }
    })();
  }, [authed, folderId]);

  // Save settings locally
  function handleSaveSettings() {
    localStorage.setItem(LS_KEYS.clientId, clientId.trim());
    localStorage.setItem(LS_KEYS.folderId, folderId.trim());
    localStorage.setItem(LS_KEYS.cc, ccEmail.trim());
    setStatus("Settings saved");
  }

  // Sign in
  async function handleSignIn() {
    try {
      setStatus("Signing in…");
      await requestAccess();
      setAuthed(true);
      setStatus("Signed in (authed)");
    } catch (e) {
      console.error(e);
      alert("Sign-in failed. Check your OAuth client ID and test users/scopes.");
      setStatus("Idle");
    }
  }

  function handleSignOut() {
    googleSignOut();
    setAuthed(false);
    setStatus("Signed out");
  }

  // Generate a simple PDF (letter-like)
  async function createInvoicePDFBlob() {
    const jsPDF = await getJsPDF();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const l = 60;
    let y = 72;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Invoice", l, y); y += 24;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoiceNo}`, l, y); y += 16;
    doc.text(`Invoice date: ${invoiceDate}`, l, y); y += 16;
    doc.text(`Due date: ${dueDate}`, l, y); y += 28;

    doc.setFont("helvetica", "bold");
    doc.text("Billed to:", l, y); y += 16;
    doc.setFont("helvetica", "normal");
    const lines = [
      contact.name || "",
      contact.addr1 || "",
      contact.addr2 || "",
      contact.cityzip || "",
    ].filter(Boolean);
    lines.forEach((line) => { doc.text(line, l, y); y += 14; });
    y += 20;

    // Totals placeholder (you can expand later)
    doc.setFont("helvetica", "bold");
    doc.text("Total:", l, y); doc.setFont("helvetica", "normal"); doc.text("£0.00", l + 50, y);

    const blob = doc.output("blob");
    return blob;
  }

  // Save to Drive and (optionally) send email
  async function handleSaveAndSend() {
    if (!authed) {
      alert("Please sign in first.");
      return;
    }
    if (!folderId) {
      alert("Please enter your Drive Folder ID and save settings.");
      return;
    }

    try {
      setStatus("Creating PDF…");
      const pdfBlob = await createInvoicePDFBlob();
      const safeNo = invoiceNo.replace(/[#/]/g, "_");
      const fileName = `Invoice_${safeNo}.pdf`;

      setStatus("Uploading to Drive…");
      const created = await createFile(folderId, fileName, "application/pdf", pdfBlob);
      const fileLink = created.webViewLink || driveFileViewLink(created.id);

      // Update history
      const files = await listFiles(folderId, { limit: 20 });
      setHistory(files || []);

      // Auto-increment invoice series if not overridden
      if (!overrideNo) {
        const yy = twoDigitYear();
        const current = invoiceNo.startsWith("#") ? invoiceNo.slice(1) : invoiceNo;
        const [seriesStr, invYY] = current.split("/");
        let series = Number(seriesStr || "0");
        let nextSeries = series + 1;
        // Store last series/year for the next session
        localStorage.setItem(LS_KEYS.lastSeries, String(nextSeries));
        localStorage.setItem(LS_KEYS.lastYear, yy);
        setInvoiceNo(`#${nextSeries}/${yy}`);
      }

      // Ask for recipient email and optionally CC (default from settings)
      const to = prompt("Send to (client email)? Leave blank to skip email.", "");
      if (to && to.includes("@")) {
        const cc = ccEmail?.trim() || "";
        setStatus("Emailing via Gmail…");

        const subject = `Invoice ${invoiceNo}`;
        const html =
          `<div>Dear ${contact.name || "client"},</div>` +
          `<div>Please find attached your invoice <b>${invoiceNo}</b>.</div>` +
          `<div>You can also view it on Drive: <a href="${fileLink}">${fileLink}</a></div>` +
          `<div style="margin-top:16px;">Warm regards,</div>`;

        await gmailSendWithAttachment({
          to,
          cc,
          subject,
          html,
          attachmentBlob: pdfBlob,
          attachmentName: fileName,
        });
      }

      setStatus("Saved" + (to ? " & emailed" : ""));
      alert("Done!");
    } catch (e) {
      console.error(e);
      alert(`Failed: ${e.message || e}`);
      setStatus("Error");
    }
  }

  // UI bits
  function HistoryItem({ file }) {
    const link = file.webViewLink || driveFileViewLink(file.id);
    const short = file.name?.replace(/\.pdf$/i, "") || file.id.slice(0, 8);
    const date = file.createdTime ? new Date(file.createdTime).toLocaleDateString() : "";
    return (
      <div className="hist-item" style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}>
        <div style={{
          width: 56, height: 72, background: "#f3f3f3",
          borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#666", flex: "0 0 auto"
        }}>
          PDF
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <a href={link} target="_blank" rel="noreferrer">{file.name || short}</a>
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>{date}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateColumns: "320px 1fr 360px", gap: 16, padding: 16, boxSizing: "border-box", background: "#fafafa", color: "#111" }}>
      {/* Left: Settings */}
      <aside style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 16, overflow: "auto" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Settings</h2>

        <label style={{ display: "block", fontSize: 12, color: "#444", marginBottom: 4 }}>Google OAuth Client ID</label>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle} placeholder="Your OAuth Client ID" />

        <label style={{ display: "block", fontSize: 12, color: "#444", margin: "12px 0 4px" }}>Drive Folder ID</label>
        <input value={folderId} onChange={(e) => setFolderId(e.target.value)} style={inputStyle} placeholder="Drive folder ID" />

        <label style={{ display: "block", fontSize: 12, color: "#444", margin: "12px 0 4px" }}>Accountant CC (optional)</label>
        <input value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} style={inputStyle} placeholder="name@domain.com" />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={handleSaveSettings} style={btn()}>Save settings</button>
          {!authed ? (
            <button onClick={handleSignIn} style={btn("solid")}>Sign in with Google</button>
          ) : (
            <button onClick={handleSignOut} style={btn("ghost")}>Sign out</button>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>Status: {status}</div>
      </aside>

      {/* Center: Invoice form + preview */}
      <main style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 16, overflow: "auto" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Invoice</h2>

        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
          <div style={labelStyle}>Name</div>
          <input style={inputStyle} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />

          <div style={labelStyle}>Address line 1</div>
          <input style={inputStyle} value={contact.addr1} onChange={(e) => setContact({ ...contact, addr1: e.target.value })} />

          <div style={labelStyle}>Address line 2</div>
          <input style={inputStyle} value={contact.addr2} onChange={(e) => setContact({ ...contact, addr2: e.target.value })} />

          <div style={labelStyle}>City/Zip</div>
          <input style={inputStyle} value={contact.cityzip} onChange={(e) => setContact({ ...contact, cityzip: e.target.value })} />

          <div style={labelStyle}>Invoice #</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...inputStyle, flex: 1, background: overrideNo ? "#fff" : "#f4f4f4" }}
              value={invoiceNo}
              disabled={!overrideNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#333" }}>
              <input type="checkbox" checked={overrideNo} onChange={(e) => setOverrideNo(e.target.checked)} />
              Override invoice number
            </label>
          </div>

          <div style={labelStyle}>Invoice date</div>
          <input
            style={inputStyle}
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            placeholder="dd/mm/yyyy"
          />
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          Due date (+15d by default): <b>{dueDate}</b>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={handleSaveAndSend} style={btn("solid")}>Save (saves to Drive & emails)</button>
        </div>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Preview (lightweight)</h3>
          <div style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            background: "#fcfcfc",
            fontSize: 14
          }}>
            <div>{invoiceDate} → due {dueDate}</div>
            <div style={{ marginTop: 6 }}>Invoice <b>{invoiceNo}</b></div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600 }}>Billed to</div>
              <div>{contact.name || <span style={{ color: "#999" }}>(name)</span>}</div>
              <div>{contact.addr1}</div>
              <div>{contact.addr2}</div>
              <div>{contact.cityzip}</div>
            </div>
            <div style={{ marginTop: 10, color: "#555" }}>
              (Items/amounts omitted in this minimal preview — PDF includes the header and total placeholder.)
            </div>
          </div>
        </section>
      </main>

      {/* Right: History */}
      <aside style={{ background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 16, overflow: "auto" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Invoice History</h2>
        {!authed || !folderId ? (
          <div style={{ fontSize: 13, color: "#666" }}>Sign in and save your Drive folder ID to load history.</div>
        ) : history.length === 0 ? (
          <div style={{ fontSize: 13, color: "#666" }}>No invoices yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((f) => <HistoryItem key={f.id} file={f} />)}
          </div>
        )}
      </aside>
    </div>
  );
}

// ---- styles
const inputStyle = {
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};

const labelStyle = { fontSize: 13, color: "#333" };

function btn(kind = "light") {
  const base = {
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    cursor: "pointer",
    border: "1px solid #ddd",
    background: "#fff",
  };
  if (kind === "solid") return { ...base, background: "#111", color: "#fff", border: "1px solid #111" };
  if (kind === "ghost") return { ...base, background: "#f7f7f7" };
  return base;
}
