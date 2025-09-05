import { getAccessToken } from './googleAuth.js'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

async function authFetch(url, opts={}) {
  const token = getAccessToken()
  if (!token) throw new Error('Not authed')
  return fetch(url, { ...opts, headers: { ...(opts.headers||{}), Authorization: `Bearer ${token}` } })
}

export async function ensureFolder(folderId) {
  const r = await authFetch(`${DRIVE_API}/files/${folderId}?fields=id,name,mimeType`)
  if (!r.ok) throw new Error('Cannot access target folder; check sharing/ID')
  const j = await r.json()
  if (j.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Provided ID is not a folder')
  return j
}

export async function listFiles(folderId, qExtra='', fields='files(id,name,modifiedTime,size,mimeType)') {
  const q = `'${folderId}' in parents and trashed=false ${qExtra ? ' and ' + qExtra : ''}`
  const r = await authFetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=200&orderBy=modifiedTime desc`)
  if (!r.ok) throw new Error('List failed')
  return (await r.json()).files || []
}

export async function getFileByName(folderId, name) {
  const files = await listFiles(folderId, `name='${name.replace("'","\'")}'`)
  return files[0] || null
}

export async function readJson(folderId, name) {
  const f = await getFileByName(folderId, name)
  if (!f) return null
  const r = await authFetch(`${DRIVE_API}/files/${f.id}?alt=media`)
  if (!r.ok) throw new Error('Read JSON failed')
  return await r.json()
}

export async function writeJson(folderId, name, obj) {
  const body = JSON.stringify(obj, null, 2)
  return uploadString(folderId, name, body, 'application/json')
}

export async function uploadBlob(folderId, name, blob, mime) {
  const meta = { name, parents: [folderId] }
  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelim = `\r\n--${boundary}--`
  const metaPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}`
  const headerPart = `${delimiter}Content-Type: ${mime}\r\n\r\n`
  const reader = await blob.arrayBuffer()
  const body = new Blob([metaPart, headerPart, new Uint8Array(reader), closeDelim])

  const r = await authFetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  })
  if (!r.ok) throw new Error('Upload failed')
  return await r.json()
}

export async function uploadString(folderId, name, content, mime) {
  const blob = new Blob([content], { type: mime })
  return uploadBlob(folderId, name, blob, mime)
}
