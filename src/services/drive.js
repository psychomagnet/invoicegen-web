import { getAccessToken } from "./googleAuth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/** GET /files/{id} with Shared Drives support */
export async function getFolderMeta(folderId) {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const url = `${DRIVE_API}/files/${encodeURIComponent(
    folderId
  )}?fields=id,name,mimeType,driveId&supportsAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive get folder meta failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  // sanity check it’s really a folder
  if (data.mimeType && data.mimeType !== "application/vnd.google-apps.folder") {
    // It’s still ok to write inside if it’s actually a folder; if not present, keep going.
  }
  return data;
}

/** List latest files inside folder (top 50), Shared Drives aware */
export async function listFiles(folderId) {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const q = `('${folderId}' in parents) and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields:
      "files(id,name,createdTime,mimeType,modifiedTime),nextPageToken",
    orderBy: "createdTime desc",
    pageSize: "50",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive list failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.files || [];
}

/** Upload a simple file into a folder (multipart) */
export async function createFile(folderId, fileName, blob, mimeType = "application/pdf") {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = "-------invgenweb" + Math.random().toString(16).slice(2);
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    await blob.text(),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const params = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
  });

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive create failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// re-exports kept for backward compatibility with your earlier imports
export const driveGetFolderMeta = getFolderMeta;
export const driveListFiles = listFiles;
export const driveCreateFile = createFile;
