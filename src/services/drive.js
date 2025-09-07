// src/services/drive.js
import { getAccessToken } from "./googleAuth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

/** Internal: fetch with bearer */
async function authFetch(url, opts = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  const headers = new Headers(opts.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...opts, headers });
}

/** Verify the folder exists and is a folder the user can access */
export async function getFolderMeta(folderId) {
  const url = `${DRIVE_API}/files/${encodeURIComponent(
    folderId
  )}?fields=id,name,mimeType,webViewLink,capabilities(canAddChildren)`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Drive get folder meta failed: ${res.status}`);
  const meta = await res.json();
  if (meta.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Provided ID is not a folder");
  }
  return meta;
}

/**
 * List recent PDF files in the folder (newest first).
 * Returns: { files: [...], nextPageToken? }
 * File fields: id, name, mimeType, webViewLink, createdTime, thumbnailLink, size
 */
export async function listFiles(folderId, { limit = 20, pageToken = "" } = {}) {
  const q = `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`;
  const params = new URLSearchParams({
    q,
    orderBy: "createdTime desc",
    pageSize: String(limit),
    fields:
      "files(id,name,mimeType,webViewLink,createdTime,thumbnailLink,size),nextPageToken",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const url = `${DRIVE_API}/files?${params.toString()}`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Drive list files failed: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

/**
 * Create a file (PDF) inside the folder.
 * blobOrBytes can be a Blob, File, or Uint8Array.
 * Returns: { id, name, webViewLink, createdTime, mimeType }
 */
export async function createFile(
  folderId,
  name,
  mimeType,
  blobOrBytes
) {
  const boundary = "invgen_multipart_" + Math.random().toString(36).slice(2);
  const meta = {
    name,
    parents: [folderId],
    mimeType,
  };

  let fileBlob;
  if (blobOrBytes instanceof Blob) {
    fileBlob = blobOrBytes;
  } else if (blobOrBytes?.constructor === Uint8Array) {
    fileBlob = new Blob([blobOrBytes], { type: mimeType });
  } else {
    throw new Error("Unsupported data type for createFile()");
  }

  const metaPart = new Blob([JSON.stringify(meta)], {
    type: "application/json; charset=UTF-8",
  });

  // Build multipart body
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      metaPart,
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
      fileBlob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const url = `${UPLOAD_API}?uploadType=multipart&fields=id,name,webViewLink,createdTime,mimeType`;
  const res = await authFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Drive create file failed: ${res.status} ${t}`);
  }
  return await res.json();
}

// (Optional) export as a single object too
export default {
  getFolderMeta,
  listFiles,
  createFile,
};
