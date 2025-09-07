// src/services/drive.js
import { ensureAccess } from "./googleAuth";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

/** Read a folder's basic metadata (id, name, mimeType) */
export async function getFolderMeta(folderId) {
  // Try silent; if we don’t have a token, fall back to interactive
  let token;
  try {
    token = await ensureAccess({ interactive: false });
  } catch {
    token = await ensureAccess({ interactive: true });
  }

  const res = await fetch(`${DRIVE_API}/${encodeURIComponent(folderId)}?fields=id,name,mimeType`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive get folder meta failed: ${res.status}`);
  return res.json();
}

/** (stubs you might already have / will add)
export async function createFile(folderId, name, mimeType, blobOrBuffer) { ... }
export async function listFiles(folderId, pageToken) { ... }
export async function driveCreateFile(args) { ... }
export async function driveListFiles(args) { ... }
*/
