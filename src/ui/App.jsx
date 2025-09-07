import React, { useEffect, useMemo, useState } from "react";
import Login from "./Login.jsx";
import { getFolderMeta, listFiles, createFile } from "../services/drive";
import { initGoogleAuth, getAccessToken, requestAccess, signOut as googleSignOut } from "../services/googleAuth";

const LS_KEYS = {
  clientId: "inv_web_client_id",
  folderId: "inv_web_folder_id",
  ccEmail: "inv_web_cc_email",
  numbering: "inv_numbering_rules_v2",
  contacts: "inv_quick_contacts_v1",
};

function twoYY(d = new Date()) { return String(d.getFullYear() % 100).padStart(2, "0"); }
function currency(amount, symbol = "£") { return `${symbol}${Number(amount || 0).toFixed(2)}`; }

export default function App() {
  const [clientId, setClientId] = useState(localStorage.getItem(LS_KEYS.clientId) || "");
  const [folderId, setFolderId] = useState(localStorage.getItem(LS_KEYS.folderId) || "");
  const [ccEmail, setCcEmail] = useState(localStorage.getItem(LS_KEYS.ccEmail) || "");
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEYS.contacts) || "[]"); } catch { return []; }
  });

  const [numRules, setNumRules] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(LS_KEYS.numbering) ||
          JSON.stringify({ lastSeries: 0, lastYear: twoYY(), resetEachYear: true })
      );
    } catch {
      return { lastSeries: 0, lastYear: twoYY(), resetEachYear: true };
    }
  });

  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState("Idle");

  const [name, setName] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [cityzip, setCityzip] = useState("");
  const [overrideNum, setOverrideNum] = useState(false);

  const nextNumberLabel = useMemo(() => {
    const yy = twoYY();
    const rollover = numRules.resetEachYear && numRules.lastYear !== yy;
    const nextSeries = rollover ? 1 : (Number(numRules.lastSeries) || 0) + 1;
    return `#${nextSeries}/${yy}`;
  }, [numRules]);

  const [invoiceNo, setInvoiceNo] = useState(nextNumberLabel);
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  });

  const [items, setItems] = useState([{ id: 1, description: "Item", qty: 1, rate: 0 }]);
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.rate)||0), 0),
    [items]
  );

  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => { if (clientId) { try { initGoogleAuth(clientId); } catch {} } }, [clientId]);

  useEffect(() => {
    async function load() {
      if (!authed || !folderId) return;
      try {
        setStatus("Checking Drive folder…");
        await getFolderMeta(folderId);
        setStatus("Loading history…");
        const files = await listFiles(folderId);
        setHistory(files.map(f => ({
          id: f.id, name: f.name,
          link: `https://drive.google.com/file/d/${f.id}/view`,
          createdTime: f.createdTime
        })));
        setStatus("Ready");
      } catch (e) {
        setStatus(`Drive error: ${e.message}`);
      }
    }
    load();
  }, [authed, folderId]);

  function persistNumbering(next) {
    setNumRules(next);
    localStorage.setItem(LS_KEYS.numbering, JSON.stringify(next));
  }
  function persistContacts(next) {
    setContacts(next);
    localStorage.setItem(LS_KEYS.contacts, JSON.stringify(next));
  }
  function onAuthedFromLogin({ clientId, folderId }) {
    setClientId(clientId); setFolderId(folderId); setAuthed(true);
  }

  async function ensureAuthed() {
    if (!getAccessToken()) await requestAccess();
  }

  async function handleSave() {
    try {
      await ensureAuthed();

      let usedNo = invoiceNo;
      if (!overrideNum) {
        usedNo = nextNumberLabel;
        setInvoiceNo(usedNo);
        const yy = twoYY();
        const rollover = numRules.resetEachYear && numRules.lastYear !== yy;
        const nextSeries = rollover ? 1 : (Number(numRules.lastSeries)||0) + 1;
        persistNumbering({ ...numRules, lastSeries: nextSeries, lastYear: yy });
      }

      const pdfName = `invoice_${usedNo.replace(/[#/]/g,"_")}.txt`;
      const body =
        `Invoice ${usedNo}\n\nBilled to:\n${name}\n${addr1}\n${addr2}\n${cityzip}\n\nItems:\n` +
        items.map(it => `• ${it.description} — ${it.qty} @ ${it.rate}`).join("\n") +
        `\n\nSubtotal: ${currency(subtotal)}`;

      const blob = new Blob([body], { type: "text/plain" });

      setStatus("Uploading to Drive…");
      await createFile(folderId, pdfName, blob, "text/plain");

      const files = await listFiles(folderId);
      setHistory(files.map(f => ({
        id: f.id, name: f.name,
        link: `https://drive.google.com/file/d/${f.id}/view`,
        createdTime: f.createdTime
      })));

      setStatus("Saved");
    } catch (e) {
      setStatus(`Save error: ${e.message}`);
    }
  }

  function handleSignOut() {
    try { googleSignOut(); } catch {}
    setAuthed(false);
    setStatus("Signed out");
  }

  const token = getAccessToken();
  if (!token || !clientId || !folderId || !authed) return <Login onAuthed={onAuthedFromLogin} />;

  return (
    <>
      <div className="appbar">
        <div className="title">InvoiceGen Web</div>
        <div className="status">{status}</div>
      </div>

      <div className="layout">
        {/* Left: History */}
        <aside className="panel" style={{ display: historyOpen ? "block" : "none" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <h2>Invoice History</h2>
            <button className="btn btn-small" onClick={() => setHistoryOpen(false)}>Hide</button>
          </div>
          {history.length === 0 ? (
            <div className="help">No invoices yet.</div>
          ) : (
            <div className="list">
              {history.map(h => (
                <a key={h.id} href={h.link} target="_blank" rel="noreferrer">
                  <div className="item">
                    <div style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {h.name}
                    </div>
                    <div className="meta">{new Date(h.createdTime).toLocaleString()}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </aside>

        {/* Center: Form + preview */}
        <main className="panel">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <h2>Invoice</h2>
            {!historyOpen && <button className="btn btn-small" onClick={() => setHistoryOpen(true)}>Show history</button>}
          </div>

          <div className="row">
            <div className="field" style={{ gridColumn: "span 1 / span 1" }}>
              <label>Name</label>
              <input className="input" value={name} onChange={(e)=>setName(e.target.value)} />
            </div>
            <div className="field">
              <label>Quick contacts</label>
              <select className="select" onChange={(e)=>{
                const idx = Number(e.target.value);
                if (!Number.isNaN(idx) && contacts[idx]) {
                  const c = contacts[idx];
                  setName(c.name||""); setAddr1(c.address1||""); setAddr2(c.address2||""); setCityzip(c.cityzip||"");
                }
              }}>
                <option value="">—</option>
                {contacts.map((c,i)=>(<option key={i} value={i}>{c.name}</option>))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Address line 1</label>
            <input className="input" value={addr1} onChange={(e)=>setAddr1(e.target.value)} />
          </div>
          <div className="field">
            <label>Address line 2</label>
            <input className="input" value={addr2} onChange={(e)=>setAddr2(e.target.value)} />
          </div>
          <div className="field">
            <label>City/Zip</label>
            <input className="input" value={cityzip} onChange={(e)=>setCityzip(e.target.value)} />
          </div>

          <div className="row">
            <div className="field">
              <label>Invoice #</label>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  className="input"
                  value={invoiceNo}
                  onChange={(e)=>setInvoiceNo(e.target.value)}
                  disabled={!overrideNum}
                />
                <label className="help" style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <input type="checkbox" checked={overrideNum} onChange={(e)=>setOverrideNum(e.target.checked)} />
                  Override
                </label>
              </div>
            </div>
            <div className="field">
              <label>Invoice date</label>
              <input className="input" value={invoiceDate} onChange={(e)=>setInvoiceDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Items</label>
            {items.map(it=>(
              <div key={it.id} className="row" style={{ alignItems:"center", marginBottom:8 }}>
                <input className="input" style={{ gridColumn:"span 7 / span 7" }} value={it.description}
                  onChange={(e)=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, description:e.target.value}:p))} />
                <input className="input" type="number" style={{ gridColumn:"span 2 / span 2" }} value={it.qty}
                  onChange={(e)=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, qty:Number(e.target.value)}:p))} />
                <input className="input" type="number" style={{ gridColumn:"span 2 / span 2" }} value={it.rate}
                  onChange={(e)=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, rate:Number(e.target.value)}:p))} />
                <button className="btn btn-small" onClick={()=>setItems(prev=>prev.filter(p=>p.id!==it.id))}>–</button>
              </div>
            ))}
            <button className="btn btn-small" onClick={()=>setItems(prev=>[...prev, { id: Date.now(), description:"", qty:1, rate:0 }])}>
              Add item
            </button>
          </div>

          <div style={{ textAlign:"right", fontSize:14, marginTop:8 }}>
            <b>Subtotal:</b> {currency(subtotal)}
          </div>

          <div style={{ marginTop:12 }}>
            <button className="btn btn-primary" onClick={handleSave}>Save (Drive & emails)</button>
          </div>

          <div className="preview" style={{ marginTop:12 }}>
            <div>
              {invoiceDate} → <span style={{ color:"var(--muted)" }}>
                due {(() => { const [dd,mm,yyyy]=invoiceDate.split("/").map(Number); const d=new Date(yyyy,mm-1,dd); d.setDate(d.getDate()+15); return d.toLocaleDateString(); })()}
              </span>
            </div>
            <div>Invoice <span style={{ fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" }}>{invoiceNo}</span></div>
            <div style={{ marginTop:8 }}>
              <div className="help" style={{ textTransform:"uppercase" }}>Billed to</div>
              <div>
                <div style={{ fontWeight:600 }}>{name}</div>
                {addr1 && <div>{addr1}</div>}
                {addr2 && <div>{addr2}</div>}
                {cityzip && <div>{cityzip}</div>}
              </div>
            </div>
          </div>
        </main>

        {/* Right: Settings */}
        <aside className="panel" style={{ position:"sticky", top:88, height:"fit-content" }}>
          <h2>Settings</h2>

          <div className="field">
            <label>Accountant CC (optional)</label>
            <input
              className="input"
              placeholder="name@domain.com"
              value={ccEmail}
              onChange={(e)=>{ setCcEmail(e.target.value); localStorage.setItem(LS_KEYS.ccEmail, e.target.value); }}
            />
          </div>

          <div className="panel" style="padding:12px; margin:12px 0;">
            <div style="font-weight:600; margin-bottom:6px;">Numbering</div>
            <div className="help" style="margin-bottom:6px;">Next #: <span style="font-family:monospace;">{nextNumberLabel}</span></div>
            <label className="help" style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input
                type="checkbox"
                checked={numRules.resetEachYear}
                onChange={(e)=>persistNumbering({ ...numRules, resetEachYear: e.target.checked })}
              />
              Reset series each Jan 1
            </label>
          </div>

          <div className="panel" style="padding:12px; margin:12px 0;">
            <div style="font-weight:600; margin-bottom:6px;">Quick contacts</div>
            <button className="btn btn-small" onClick={()=>persistContacts([...contacts, { name:"", address1:"", address2:"", cityzip:"" }])}>
              Add contact
            </button>
            <div style={{ display:"grid", gap:8, marginTop:8 }}>
              {contacts.map((c,idx)=>(
                <div key={idx} className="panel" style={{ padding:8 }}>
                  <input className="input" style={{ marginBottom:6 }} placeholder="Name" value={c.name}
                    onChange={(e)=>persistContacts(contacts.map((x,i)=>i===idx?{...x, name:e.target.value}:x))}/>
                  <input className="input" style={{ marginBottom:6 }} placeholder="Address line 1" value={c.address1||""}
                    onChange={(e)=>persistContacts(contacts.map((x,i)=>i===idx?{...x, address1:e.target.value}:x))}/>
                  <input className="input" style={{ marginBottom:6 }} placeholder="Address line 2" value={c.address2||""}
                    onChange={(e)=>persistContacts(contacts.map((x,i)=>i===idx?{...x, address2:e.target.value}:x))}/>
                  <input className="input" placeholder="City/Zip" value={c.cityzip||""}
                    onChange={(e)=>persistContacts(contacts.map((x,i)=>i===idx?{...x, cityzip:e.target.value}:x))}/>
                  <div style={{ textAlign:"right", marginTop:6 }}>
                    <button className="btn btn-small" onClick={()=>persistContacts(contacts.filter((_,i)=>i!==idx))}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
            <button className="btn btn-small" onClick={handleSignOut}>Sign out</button>
          </div>
        </aside>
      </div>
    </>
  );
}
