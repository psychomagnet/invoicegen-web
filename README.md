# InvoiceGen Web (source)

- React + Vite SPA
- Google Identity Services (popup) + Drive API persistence
- Saves `contacts.json`, `numbering.json`, and per-invoice JSON/PDF to your chosen Drive folder
- Invoice date defaults to **today**, due date to **+15 days**
- Invoice number is **locked** by default; toggle **Override** to edit
- On **Send**: saves to Drive + increments counter; old invoice edits do not change numbering

## Local dev
```
npm install
npm run dev
```

Open http://localhost:5173 and paste your **OAuth Client ID** and **Drive Folder ID** in Settings, then **Sign in**.
