// src/services/gmail.js
import { getAccessToken } from "./googleAuth";

// Convert string to base64url
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Send a MIME email via Gmail API with (optional) attachments.
 * attachments: [{ name, blob, contentType }]
 */
export async function sendMessage({ to, cc = "", subject, html, attachments = [] }) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const boundary = "gmail_boundary_" + Math.random().toString(36).slice(2);
  const nl = "\r\n";

  // Build body
  let body =
    `Content-Type: multipart/mixed; boundary="${boundary}"${nl}` +
    `MIME-Version: 1.0${nl}` +
    `to: ${to}${nl}` +
    (cc ? `cc: ${cc}${nl}` : "") +
    `subject: ${subject}${nl}${nl}` +
    `--${boundary}${nl}` +
    `Content-Type: text/html; charset="UTF-8"${nl}${nl}` +
    `${html}${nl}${nl}`;

  // Attachments
  for (const att of attachments) {
    const bytes = new Uint8Array(await att.blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);

    body +=
      `--${boundary}${nl}` +
      `Content-Type: ${att.contentType || "application/octet-stream"}; name="${att.name}"${nl}` +
      `Content-Disposition: attachment; filename="${att.name}"${nl}` +
      `Content-Transfer-Encoding: base64${nl}${nl}` +
      `${b64}${nl}`;
  }

  body += `--${boundary}--`;

  const raw = base64UrlEncode(body);
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${t}`);
  }
  return await res.json();
}

export default { sendMessage };
