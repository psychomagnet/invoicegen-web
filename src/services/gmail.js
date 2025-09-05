import { getAccessToken } from './googleAuth.js'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

function base64url(input) {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sendEmail({ to, subject, bodyText, attachments=[] }) {
  const token = getAccessToken()
  if (!token) throw new Error('Not authed')

  const boundary = 'invoicegen-boundary'
  const parts = []
  parts.push(`Content-Type: text/plain; charset="UTF-8"\r\n\r\n${bodyText}`)

  for (const a of attachments) {
    const content = await a.blob.arrayBuffer()
    const binary = String.fromCharCode(...new Uint8Array(content))
    const b64 = btoa(binary)
    parts.push(
      `Content-Type: ${a.mime}; name="${a.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.filename}"\r\n\r\n${b64}`
    )
  }

  const raw =
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
    parts.map(p => `--${boundary}\r\n${p}`).join('\r\n') +
    `\r\n--${boundary}--`

  const r = await fetch(GMAIL_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64url(raw) })
  })
  if (!r.ok) throw new Error('Gmail send failed')
  return await r.json()
}
