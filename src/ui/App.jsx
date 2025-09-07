// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import Login from "./Login.jsx";

// Drive helpers (already updated in your repo)
import {
  getFolderMeta,
  createFile,
  listFiles,
  driveGetFolderMeta,
  driveCreateFile,
  driveListFiles,
} from "../services/drive";

// Google auth helpers
import {
  initGoogleAuth,
  getAccessToken,
  requestAccess,
  signOut as googleSignOut,
} from "../services/googleAuth";

const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
  ccEmail: "inv_web_cc_email",
  numbering: "inv_numbering_rules_v2",
  contacts: "inv_quick_contacts_v1",
};

function twoYY(d = new Date()) {
  return String(d.getFullYear() % 100).padStart(2, "0");
}

function currency(amount, symbol = "£", locale = "en-GB") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency:
        symbol === "£" ? "GBP" : symbol === "$" ? "USD" : symbol === "€" ? "EUR" : undefined,
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${symbol}${Number(amount || 0).toFixed(2)}`;
  }
}

export default function App() {
  // Global settings (persisted)
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [ccEmail, setCcEmail] = useState(localStorage.getItem(LS_KEYS.ccEmail) || "");
  const [contacts, setContacts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.contacts) || "[]");
    } catch {
      return [];
    }
  });

  // Numbering rules
  const [numRules, setNumRules] = useState(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem(LS_KEYS.numbering) ||
            JSON.stringify({ lastSeries: 0, lastYear: twoYY(), resetEachYear: true })
        ) || { lastSeries: 0, lastYear: twoYY(), resetEachYear: true }
      );
    } catch {
      return { lastSeries: 0, lastYear: twoYY(), resetEachYear: true };
    }
  });

  // Auth state
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState("Idle");

  // UI state (invoice form)
  const [name, setName] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [cityzip, setCityzip] = useState("");
  const [overrideNum, setOverrideNum] = useState(false);

  // compute next invoice number
  const nextNumberLabel = useMemo(() => {
    const yy = twoYY();
    const rollover = numRules.resetEachYear && numRules.lastYear !== yy;
    const nextSeries = rollover ? 1 : (Number(numRules.lastSeries) || 0) + 1;
    return `#${nextSeries}/${yy}`;
  }, [numRules]);

  const [invoiceNo, setInvoiceNo] = useState(nextNumberLabel);
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const d = new Date();
    // dd/mm/yyyy
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });

  // items – keep minimal (description/qty/rate)
  const [items, setItems] = useState([{ id: 1, description: "Item", qty: 1, rate: 0 }]);
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0),
    [items]
  );

  // History (right drawer links)
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Initialize auth if we already have a clientId (fresh reload after login)
  useEffect(() => {
    if (!clientId) return;
    try {
      initGoogleAuth(clientId);
    } catch (e) {
      // show but don’t block – user can sign out/in from settings
      console.warn("init auth error", e);
    }
  }, [clientId]);

  // Just after we become authed, verify folder + load history list
  useEffect(() => {
    async function load() {
      if (!authed || !folderId) return;
      try {
        setStatus("Checking Drive folder…");
        // will throw if not reachable
        await getFolderMeta(folderId);
        setStatus("Loading history…");
        const files = await listFiles(folderId);
        setHistory(
          files.map((f) => ({
            id: f.id,
            name: f.name,
            link: `https://drive.google.com/file/d/${f.id}/view`,
            createdTime: f.createdTime,
          }))
        );
        setStatus("Ready");
      } catch (e) {
        setStatus(`Drive error: ${e.message}`);
      }
    }
    load();
  }, [authed, folderId]);

  function persistNumbering(next) {
    setNumRules(next);
    try {
      localStorage.setItem(LS_KEYS.numbering, JSON.stringify(next));
    } catch {}
  }

  function persistContacts(next) {
    setContacts(next);
    try {
      localStorage.setItem(LS_KEYS.contacts, JSON.stringify(next));
    } catch {}
  }

  function onAuthedFromLogin({ clientId, folderId }) {
    setClientId(clientId);
    setFolderId(folderId);
    setAuthed(true);
  }

  async function ensureAuthed() {
    const token = getAccessToken();
    if (!token) {
      await requestAccess();
    }
  }

  async function handleSave() {
    try {
      await ensureAuthed();

      // lock/increment invoice number when saving unless user overrode it
      let usedNo = invoiceNo;
      if (!overrideNum) {
        usedNo = nextNumberLabel;
        setInvoiceNo(usedNo);
        // advance series
        const yy = twoYY();
        const rollover = numRules.resetEachYear && numRules.lastYear !== yy;
        const nextSeries = rollover ? 1 : (Number(numRules.lastSeries) || 0) + 1;
        persistNumbering({ ...numRules, lastSeries: nextSeries, lastYear: yy });
      }

      // Build a simple PDF body (for now basic text; your desktop layout can be ported later)
      const pdfName = `invoice_${usedNo.replace(/[#/]/g, "_")}.txt`;
      const body =
        `Invoice ${usedNo}\n\n` +
        `Billed to:\n${name}\n${addr1}\n${addr2}\n${cityzip}\n\n` +
        `Items:\n` +
        items.map((it) => `• ${it.description} — ${it.qty} @ ${it.rate}`).join("\n") +
        `\n\nSubtotal: ${currency(subtotal)}`;

      const blob = new Blob([body], { type: "text/plain" });

      setStatus("Uploading to Drive…");
      const created = await createFile(folderId, pdfName, blob, "text/plain");

      // refresh history
      const files = await listFiles(folderId);
      setHistory(
        files.map((f) => ({
          id: f.id,
          name: f.name,
          link: `https://drive.google.com/file/d/${f.id}/view`,
          createdTime: f.createdTime,
        }))
      );

      // (Optional) send email with Drive link – keep your existing gmail helper if configured
      if (ccEmail && ccEmail.includes("@")) {
        // Hook up your gmail service here when you’re ready.
        // await sendInvoiceEmail({ to:nameEmail?, cc:ccEmail, link: `https://drive.google.com/file/d/${created.id}/view` })
      }

      setStatus("Saved");
    } catch (e) {
      setStatus(`Save error: ${e.message}`);
    }
  }

  function handleSignOut() {
    try {
      googleSignOut();
    } catch {}
    setAuthed(false);
    setStatus("Signed out");
  }

  // If we have never signed in (no token yet), show Login
  const token = getAccessToken();
  if (!token || !clientId || !folderId || !authed) {
    return <Login onAuthed={onAuthedFromLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">InvoiceGen Web</div>
        <div className="text-xs text-neutral-600">{status}</div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4">
        {/* Left: History (collapsible) */}
        <aside className={`col-span-3 ${historyOpen ? "" : "hidden"} md:block`}>
          <div className="bg-white rounded-xl shadow p-4 h-[calc(100vh-7rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">Invoice History</h2>
              <button
                className="text-xs px-2 py-1 rounded border"
                onClick={() => setHistoryOpen(false)}
              >
                Hide
              </button>
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-neutral-500">No invoices yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <a
                    key={h.id}
                    href={h.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block border rounded-lg hover:bg-neutral-50"
                  >
                    <div className="p-2">
                      <div className="text-sm font-medium truncate">{h.name}</div>
                      <div className="text-xs text-neutral-500">
                        {new Date(h.createdTime).toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center: Invoice form + preview */}
        <main className={`${historyOpen ? "col-span-6" : "col-span-8"} transition-all`}>
          <div className="bg-white rounded-xl shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Invoice</h2>
              {!historyOpen && (
                <button
                  className="text-xs px-2 py-1 rounded border"
                  onClick={() => setHistoryOpen(true)}
                >
                  Show history
                </button>
              )}
            </div>

            {/* Contact quick-select (from your JSON contacts) */}
            <div className="grid grid-cols-12 gap-2 items-end">
              <label className="text-sm col-span-9">
                Name
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="text-sm col-span-3">
                Quick contacts
                <select
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (!Number.isNaN(idx) && contacts[idx]) {
                      const c = contacts[idx];
                      setName(c.name || "");
                      setAddr1(c.address1 || "");
                      setAddr2(c.address2 || "");
                      setCityzip(c.cityzip || "");
                    }
                  }}
                >
                  <option value="">—</option>
                  {contacts.map((c, i) => (
                    <option key={i} value={i}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm block">
              Address line 1
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={addr1}
                onChange={(e) => setAddr1(e.target.value)}
              />
            </label>
            <label className="text-sm block">
              Address line 2
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={addr2}
                onChange={(e) => setAddr2(e.target.value)}
              />
            </label>
            <label className="text-sm block">
              City/Zip
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                value={cityzip}
                onChange={(e) => setCityzip(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-12 gap-2">
              <label className="text-sm col-span-6">
                Invoice #
                <div className="flex gap-2">
                  <input
                    className="mt-1 flex-1 rounded-xl border border-neutral-300 px-3 py-2 disabled:bg-neutral-100"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    disabled={!overrideNum}
                  />
                  <label className="text-xs flex items-center gap-1 mt-1">
                    <input
                      type="checkbox"
                      checked={overrideNum}
                      onChange={(e) => setOverrideNum(e.target.checked)}
                    />
                    Override
                  </label>
                </div>
              </label>
              <label className="text-sm col-span-6">
                Invoice date
                <input
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </label>
            </div>

            {/* Items (minimal) */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Items</div>
              {items.map((it, idx) => (
                <div key={it.id} className="grid grid-cols-12 gap-2">
                  <input
                    className="col-span-7 rounded-xl border border-neutral-300 px-3 py-2"
                    value={it.description}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p) => (p.id === it.id ? { ...p, description: e.target.value } : p))
                      )
                    }
                  />
                  <input
                    type="number"
                    className="col-span-2 rounded-xl border border-neutral-300 px-3 py-2"
                    value={it.qty}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p) => (p.id === it.id ? { ...p, qty: Number(e.target.value) } : p))
                      )
                    }
                  />
                  <input
                    type="number"
                    className="col-span-2 rounded-xl border border-neutral-300 px-3 py-2"
                    value={it.rate}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p) => (p.id === it.id ? { ...p, rate: Number(e.target.value) } : p))
                      )
                    }
                  />
                  <button
                    className="col-span-1 rounded-xl border px-2 text-sm"
                    onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                  >
                    – 
                  </button>
                </div>
              ))}
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { id: Date.now(), description: "", qty: 1, rate: 0 },
                  ])
                }
              >
                Add item
              </button>
            </div>

            <div className="pt-2 text-right text-sm">
              <span className="font-medium">Subtotal:</span> {currency(subtotal)}
            </div>

            <div className="pt-2">
              <button className="rounded-xl bg-black text-white px-4 py-2" onClick={handleSave}>
                Save (Drive & emails)
              </button>
            </div>
          </div>

          {/* Lightweight preview card */}
          <div className="bg-white rounded-xl shadow p-4 mt-4">
            <div className="text-sm text-neutral-600">Preview (lightweight)</div>
            <div className="mt-2 text-sm">
              <div>
                {invoiceDate} →{" "}
                <span className="text-neutral-500">
                  due {/* naive +15d display */}
                  {(() => {
                    const [dd, mm, yyyy] = invoiceDate.split("/").map((n) => Number(n));
                    const d = new Date(yyyy, mm - 1, dd);
                    d.setDate(d.getDate() + 15);
                    return d.toLocaleDateString();
                  })()}
                </span>
              </div>
              <div>Invoice <span className="font-mono">{invoiceNo}</span></div>
              <div className="mt-2">
                <div className="text-xs uppercase text-neutral-500">Billed to</div>
                <div className="leading-5">
                  <div className="font-medium">{name}</div>
                  {addr1 && <div>{addr1}</div>}
                  {addr2 && <div>{addr2}</div>}
                  {cityzip && <div>{cityzip}</div>}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right: Settings */}
        <aside className={`${historyOpen ? "col-span-3" : "col-span-4"}`}>
          <div className="bg-white rounded-xl shadow p-4 space-y-4 sticky top-20">
            <h2 className="font-medium">Settings</h2>

            <label className="text-sm block">
              Accountant CC (optional)
              <input
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
                placeholder="name@domain.com"
                value={ccEmail}
                onChange={(e) => {
                  setCcEmail(e.target.value);
                  localStorage.setItem(LS_KEYS.ccEmail, e.target.value);
                }}
              />
            </label>

            <div className="text-sm p-3 rounded-xl bg-neutral-50 border">
              <div className="font-medium mb-2">Numbering</div>
              <div className="text-xs mb-2">
                Next #: <span className="font-mono">{nextNumberLabel}</span>
              </div>
              <label className="text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={numRules.resetEachYear}
                  onChange={(e) => persistNumbering({ ...numRules, resetEachYear: e.target.checked })}
                />
                Reset series each Jan 1
              </label>
            </div>

            {/* Manage quick contacts */}
            <div className="text-sm p-3 rounded-xl bg-neutral-50 border space-y-2">
              <div className="font-medium">Quick contacts</div>
              <button
                className="text-xs rounded border px-2 py-1"
                onClick={() =>
                  persistContacts([...contacts, { name: "", address1: "", address2: "", cityzip: "" }])
                }
              >
                Add contact
              </button>
              <div className="space-y-2">
                {contacts.map((c, idx) => (
                  <div key={idx} className="border rounded-lg p-2">
                    <input
                      className="w-full text-xs border rounded px-2 py-1 mb-1"
                      placeholder="Name"
                      value={c.name}
                      onChange={(e) =>
                        persistContacts(
                          contacts.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                        )
                      }
                    />
                    <input
                      className="w-full text-xs border rounded px-2 py-1 mb-1"
                      placeholder="Address line 1"
                      value={c.address1 || ""}
                      onChange={(e) =>
                        persistContacts(
                          contacts.map((x, i) => (i === idx ? { ...x, address1: e.target.value } : x))
                        )
                      }
                    />
                    <input
                      className="w-full text-xs border rounded px-2 py-1 mb-1"
                      placeholder="Address line 2"
                      value={c.address2 || ""}
                      onChange={(e) =>
                        persistContacts(
                          contacts.map((x, i) => (i === idx ? { ...x, address2: e.target.value } : x))
                        )
                      }
                    />
                    <input
                      className="w-full text-xs border rounded px-2 py-1"
                      placeholder="City/Zip"
                      value={c.cityzip || ""}
                      onChange={(e) =>
                        persistContacts(
                          contacts.map((x, i) => (i === idx ? { ...x, cityzip: e.target.value } : x))
                        )
                      }
                    />
                    <div className="mt-2 text-right">
                      <button
                        className="text-xs text-red-600"
                        onClick={() => persistContacts(contacts.filter((_, i) => i !== idx))}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button className="text-xs rounded border px-2 py-1" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
