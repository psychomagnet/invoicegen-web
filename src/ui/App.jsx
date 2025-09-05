import React, { useEffect, useState } from 'react'
import { setClientId, signInInteractive, isAuthed, signOut } from '../services/googleAuth.js'
import * as Drive from '../services/drive.js'
import InvoicePage from './InvoicePage.jsx'

export default function App() {
  const [clientId, setClientIdInput] = useState(localStorage.getItem('clientId') || '')
  const [folderId, setFolderId] = useState(localStorage.getItem('folderId') || '')
  const [authed, setAuthed] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => { if (clientId) setClientId(clientId) }, [clientId])

  async function doSignIn() {
    try {
      setStatus('Signing in...')
      await signInInteractive()
      setAuthed(isAuthed())
      setStatus('Checking Drive access...')
      await Drive.ensureFolder(folderId)
      setStatus('Ready')
    } catch (e) {
      console.error(e)
      setStatus('Error: ' + e.message)
    }
  }

  function saveSettings() {
    localStorage.setItem('clientId', clientId)
    localStorage.setItem('folderId', folderId)
    setStatus('Settings saved')
  }

  return (
    <div style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 16 }}>
      <h1>InvoiceGen Web</h1>
      <div style={{ marginBottom: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>Settings</h3>
        <div style={{ display: 'grid', gap: 8, maxWidth: 640 }}>
          <label>Google OAuth Client ID
            <input style={{ width: '100%' }} value={clientId} onChange={e=>setClientIdInput(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
          </label>
          <label>Drive Folder ID
            <input style={{ width: '100%' }} value={folderId} onChange={e=>setFolderId(e.target.value)} placeholder="Copy from your shared InvoiceGen folder URL" />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveSettings}>Save</button>
            <button onClick={doSignIn} disabled={!clientId || !folderId}>Sign in with Google</button>
            <button onClick={()=>{ signOut(); setAuthed(false); setStatus('Signed out') }}>Sign out</button>
          </div>
          <div>Status: {status}</div>
        </div>
      </div>

      {authed ? (
        <InvoicePage folderId={folderId} />
      ) : (
        <p>Save your settings and sign in to start.</p>
      )}
    </div>
  )
}
