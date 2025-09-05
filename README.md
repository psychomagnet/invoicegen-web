# invoicegen-web
Web-based Personal invoicing tool with contacts, history, and PDF export (Google Drive storage)
# InvoiceGen Web

A simple web-based invoicing app built with **React + Vite**, designed to run directly in the browser and save data to **Google Drive**.

## ✨ Features

- **Google Drive integration**
  - Stores all invoices (JSON + PDF) in a dedicated Drive folder
  - Keeps `contacts.json` and `numbering.json` so the app remembers history
- **Automatic numbering**
  - Invoice number increments by +1 on **Send**
  - Year suffix updates automatically every January
  - Locked by default, with an override toggle
- **Smart defaults**
  - Invoice Date = today
  - Due Date = today + 15 days
- **Contacts**
  - Dropdown for quick selection
  - Auto-saves a new contact when you send an invoice
  - Updates existing contacts if name matches
- **Invoice history**
  - Previous invoices stored in Google Drive
  - Editing past invoices does not affect numbering
- **Exports**
  - Generates PDF and JSON
  - (PNG export can be added later)
- **Future**
  - Gmail send support
  - Multi-user (shared Drive folder)

## 🚀 Getting Started

### 1. Set up Google Cloud
- Create a new project in [Google Cloud Console](https://console.cloud.google.com).
- Configure **OAuth consent screen** (External).
- Add scopes:
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/gmail.send`
- Create **OAuth client ID** (Web application).
- Add redirect URIs:
  - `http://localhost:5173/auth/callback` (for local dev)
  - `https://<yoursite>.netlify.app/auth/callback` (for Netlify)

### 2. Set up Google Drive
- In your **storage** Google account, create a folder called `InvoiceGen`.
- Share it with your **user** Google account (Editor).
- Copy the folder ID from the URL.

### 3. Local development
```bash
npm install
npm run dev
