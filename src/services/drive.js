// src/services/drive.js
import { getAccessTokenSync } from "./googleAuth";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

/**
 * Basic helper to fetch with Bearer token.
 */
async function authedFetch(url, options = {}) {
  const token = getAccessTokenSync();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${options.method || "GET"} ${url} failed: ${res.status} ${text}`);
  }
  return res;
}

/**
 * Confirm folder exists (works with Shared drives).
 */
export async function getFolderMeta(folderId) {
  const url = `${DRIVE_API}/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`;
  const res = await authedFetch(url);
  return res.json();
}

/**
 * Create a file inside folderId (multipart upload).
 * data can be string (for text/json) or Blob.
 */
export async function createFile({ folderId, name, mimeType = "application/json", data }) {
  const metadata = {
    name,
    parents: [folderId],
  };

  const boundary = "-------invoicegen_web_" + Math.random().toString(36).slice(2);
  const CRLF = "\r\n";
  const bodyParts = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    typeof data === "string" ? data : await data.text?.() ?? data,
    `--${boundary}--`,
    "",
  ].join(CRLF);

  const url = `${UPLOAD_API}?uploadType=multipart&supportsAllDrives=true`;
  const res = await authedFetch(url, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: bodyParts,
  });
  return res.json();
}
