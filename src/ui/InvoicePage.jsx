import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import * as Drive from '../services/drive.js'

const two = n => String(n).padStart(2,'0')
const todayISO = () => new Date().toISOString().slice(0,10)
const plusDays = (iso, d) => { const t = new Date(iso); t.setDate(t.getDate()+d); return t.toISOString().slice(0,10) }
const disp = (iso) => { const d = new Date(iso); return `${d.getDate()}.${d.getMonth()+1}.${two(d.getFullYear()%100)}` }

const defaultInv = () => ({
  billedTo: { name: '', lines: ['','',''] },
  meta: { invoiceNo: '', invoiceDateISO: todayISO(), dueDateISO: plusDays(todayISO(), 15), serviceFromISO: todayISO(), serviceToISO: todayISO() },
  items: [{ id: 1, description: '', qty: 1, rate: 0 }],
  currency: { symbol: '£', locale: 'en-GB' }
})

export default function InvoicePage({ folderId }) {
  const [inv, setInv] = useState(defaultInv())
  const [contacts, setContacts] = useState([])
  const [numbering, setNumbering] = useState({ lastSeries: 0, lastYear: String(new Date().getFullYear()%100), resetEachYear: true })
  const [override, setOverride] = useState(false)
  const subtotal = useMemo(()=>inv.items.reduce((s,it)=>s+(+it.qty||0)*(+it.rate||0),0),[inv.items])

  useEffect(()=>{ (async()=>{
    const c = await Drive.readJson(folderId,'contacts.json') || []
    const n = await Drive.readJson(folderId,'numbering.json') || { lastSeries: 0, lastYear: String(new Date().getFullYear()%100), resetEachYear: true }
    setContacts(c); setNumbering(n)
    setInv(v => ({ ...v, meta: { ...v.meta, invoiceNo: nextNumber(n) } }))
  })().catch(console.error) }, [folderId])

  function nextNumber(n) {
    const yy = String(new Date().getFullYear()%100)
    const roll = n.resetEachYear && n.lastYear !== yy
    const next = roll ? 1 : (Number(n.lastSeries||0)+1)
    return `#${next}/${yy}`
  }

  function setField(path, value) {
    setInv(prev => {
      const clone = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.'); let obj = clone
      for (let i=0;i<keys.length-1;i++) obj = obj[keys[i]]
      obj[keys.at(-1)] = value
      return clone
    })
  }

  function addContactIfMissing() {
    const name = (inv.billedTo.name||'').trim()
    const lines = (inv.billedTo.lines||[]).map(s=>s.trim()).filter(Boolean)
    if (!name) return false
    const idx = contacts.findIndex(c => c.name.trim().toLowerCase()===name.toLowerCase())
    if (idx===-1) {
      const next = contacts.concat([{ id: `c_${Date.now()}`, name, lines }])
      setContacts(next)
      Drive.writeJson(folderId,'contacts.json', next).catch(console.error)
    } else {
      const next = contacts.slice(); next[idx] = { ...next[idx], lines }
      setContacts(next)
      Drive.writeJson(folderId,'contacts.json', next).catch(console.error)
    }
    return true
  }

  async function onSend() {
    addContactIfMissing()

    const pdf = new jsPDF({ unit:'pt', format:'a4' })
    pdf.setFontSize(12)
    pdf.text(`Invoice ${inv.meta.invoiceNo}`, 40, 40)
    pdf.text(`Billed to: ${inv.billedTo.name}`, 40, 60)
    let y=90
    inv.items.forEach(it=>{ pdf.text(`${it.description}  x${it.qty}  ${(it.rate||0).toFixed(2)}`, 40, y); y+=18 })
    pdf.text(`Total: ${(subtotal).toFixed(2)} ${inv.currency.symbol}`, 40, y+10)
    const pdfBlob = pdf.output('blob')

    const base = `invoice_${inv.meta.invoiceNo.replace(/[#/]/g,'_')}`
    await Drive.writeJson(folderId, `${base}.json`, inv)
    await Drive.uploadBlob(folderId, `${base}.pdf`, pdfBlob, 'application/pdf')

    const yy = String(new Date().getFullYear()%100)
    const roll = numbering.resetEachYear && numbering.lastYear!==yy
    const nextSeries = roll ? 1 : (Number(numbering.lastSeries||0)+1)
    const updated = { ...numbering, lastSeries: nextSeries, lastYear: yy }
    setNumbering(updated)
    await Drive.writeJson(folderId, 'numbering.json', updated)

    setInv(defaultInv())
    setInv(v => ({ ...v, meta: { ...v.meta, invoiceNo: nextNumber(updated) } }))
    alert('Saved to Drive. (Email send UI next.)')
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
      <section style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
        <h3>Invoice</h3>
        <label>Contact
          <input style={{ width:'100%' }} value={inv.billedTo.name} onChange={e=>setField('billedTo.name', e.target.value)} placeholder="Name" />
        </label>
        {inv.billedTo.lines.map((l,i)=>(
          <input key={i} style={{ width:'100%', marginTop:6 }} value={l} onChange={e=>setInv(p=>({...p, billedTo:{...p.billedTo, lines: p.billedTo.lines.map((x,idx)=>idx===i?e.target.value:x)}}))} placeholder={['Address line 1','Address line 2','City/Zip'][i]||'Address'} />
        ))}
        <div style={{ marginTop:8 }}>
          <label>Invoice #
            <input style={{ width:'100%', background:override?'#fff':'#eee' }} value={inv.meta.invoiceNo} onChange={e=>setField('meta.invoiceNo', e.target.value)} disabled={!override} />
          </label>
          <label style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
            <input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)} /> Override invoice number
          </label>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
          <label>Invoice date
            <input type="date" value={inv.meta.invoiceDateISO} onChange={e=>setField('meta.invoiceDateISO', e.target.value)} />
          </label>
          <label>Due date (+15d by default)
            <input type="date" value={inv.meta.dueDateISO} onChange={e=>setField('meta.dueDateISO', e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop:12 }}>
          <button onClick={onSend}>Send (saves to Drive & increments)</button>
        </div>
      </section>

      <section style={{ border:'1px solid #ddd', borderRadius:8, padding:12 }}>
        <h3>Preview (lightweight)</h3>
        <p><b>{inv.billedTo.name}</b></p>
        <p>{disp(inv.meta.invoiceDateISO)} → due {disp(inv.meta.dueDateISO)}</p>
        <p>Invoice {inv.meta.invoiceNo}</p>
        <ul>
          {inv.items.map(it=>(<li key={it.id}>{it.description||'Item'} × {it.qty} @ {it.rate}</li>))}
        </ul>
        <p>Total: {subtotal.toFixed(2)} {inv.currency.symbol}</p>
      </section>
    </div>
  )
}
