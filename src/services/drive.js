// src/services/drive.js
// Handles Google Drive uploads (PDF/JSON) with support for Shared Drives.

export async function driveGetFolderMeta(accessToken, folderId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,driveId,owners&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Drive get folder meta failed: ${res.status} ${msg}`);
  }
  return res.json();
}

export async function driveCreateFile(accessToken, { name, mimeType, parents, data }) {
  const metadata = { name, mimeType, parents };
  const boundary = '-------314159265358979323846';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    data + '\r\n' +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Drive create failed: ${res.status} ${msg}`);
  }

  return res.json();
}

export async function driveListFiles(accessToken, folderId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(folderId)}'+in+parents&fields=files(id,name,mimeType,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Drive list failed: ${res.status} ${msg}`);
  }
  return res.json();
}
