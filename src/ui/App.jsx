// src/ui/App.jsx
import React, { useState } from 'react';

// Import Drive helpers (both default + named to avoid undefined issues)
import drive, {
  getFolderMeta,
  createFile,
  listFiles,
  driveGetFolderMeta,
  driveCreateFile,
  driveListFiles,
} from '../services/drive';

export default function App() {
  const [oauthClientId, setOauthClientId] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(25);
  const [contact, setContact] = useState({
    name: '',
    address1: '',
    address2: '',
    cityzip: '',
  });
  const [overrideNumber, setOverrideNumber] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));

  // Debug: see what functions are available
  console.log('Drive module keys:', Object.keys(drive || {}));
  console.log('Named exports present:', {
    getFolderMeta: typeof getFolderMeta,
    createFile: typeof createFile,
    listFiles: typeof listFiles,
    driveGetFolderMeta: typeof driveGetFolderMeta,
    driveCreateFile: typeof driveCreateFile,
    driveListFiles: typeof driveListFiles,
  });

  async function handleSave() {
    try {
      // Fake token placeholder (in reality: get from Google auth)
      const fakeToken = 'your-access-token-here';

      // Try folder meta check
      const folder = await getFolderMeta(fakeToken, driveFolderId);
      console.log('Folder metadata:', folder);

      // Example create call (disabled until token real)
      // await createFile(fakeToken, { name: "test.txt", mimeType: "text/plain", parents: [driveFolderId], data: "Hello" });

      alert('Save simulated. Check console logs for details.');
    } catch (err) {
      console.error('Error saving to Drive:', err);
      alert(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>InvoiceGen Web</h1>

      <section style={{ border: '1px solid #ccc', marginBottom: '1rem', padding: '1rem' }}>
        <h3>Settings</h3>
        <div>
          <label>Google OAuth Client ID</label>
          <input
            style={{ width: '100%' }}
            value={oauthClientId}
            onChange={e => setOauthClientId(e.target.value)}
          />
        </div>
        <div>
          <label>Drive Folder ID</label>
          <input
            style={{ width: '100%' }}
            value={driveFolderId}
            onChange={e => setDriveFolderId(e.target.value)}
          />
        </div>
        <button onClick={handleSave}>Save (saves to Drive & increments)</button>
      </section>

      <section style={{ border: '1px solid #ccc', marginBottom: '1rem', padding: '1rem' }}>
        <h3>Invoice</h3>
        <div>
          <label>Name</label>
          <input
            style={{ width: '100%' }}
            value={contact.name}
            onChange={e => setContact({ ...contact, name: e.target.value })}
          />
        </div>
        <div>
          <label>Address line 1</label>
          <input
            style={{ width: '100%' }}
            value={contact.address1}
            onChange={e => setContact({ ...contact, address1: e.target.value })}
          />
        </div>
        <div>
          <label>Address line 2</label>
          <input
            style={{ width: '100%' }}
            value={contact.address2}
            onChange={e => setContact({ ...contact, address2: e.target.value })}
          />
        </div>
        <div>
          <label>City/Zip</label>
          <input
            style={{ width: '100%' }}
            value={contact.cityzip}
            onChange={e => setContact({ ...contact, cityzip: e.target.value })}
          />
        </div>

        <div>
          <label>Invoice #</label>
          <input
            disabled={!overrideNumber}
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={overrideNumber}
              onChange={e => setOverrideNumber(e.target.checked)}
            />
            Override invoice number
          </label>
        </div>

        <div>
          <label>Invoice date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </section>

      <section style={{ border: '1px solid #ccc', padding: '1rem' }}>
        <h3>Preview (lightweight)</h3>
        <p>
          {new Date(date).toLocaleDateString()} → due{' '}
          {new Date(new Date(date).getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString()}
        </p>
        <p>Invoice #{invoiceNumber}</p>
        <p>{contact.name}</p>
        <p>{contact.address1}</p>
        <p>{contact.cityzip}</p>
      </section>
    </div>
  );
}
