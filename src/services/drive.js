import { getAccessToken } from "./googleAuth";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export async function getFolderMeta(folderId) {
  const token = getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${DRIVE_API}/${folderId}?fields=id,name,mimeType`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Drive get folder meta failed: ${res.status}`);
  return res.json();
}
