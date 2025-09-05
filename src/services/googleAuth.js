// GoogleAuth (GIS token client)
let tokenClient = null
let accessToken = null
let clientId = null
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send'
].join(' ')

export function setClientId(id) { clientId = id }

export function getAccessToken() { return accessToken }
export function isAuthed() { return !!accessToken }

export function signInInteractive() {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !clientId) return reject(new Error('GIS not ready or Client ID missing'))
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      prompt: 'consent',
      callback: (resp) => {
        if (resp && resp.access_token) { accessToken = resp.access_token; resolve(accessToken) }
        else reject(new Error('No access token'))
      }
    })
    tokenClient.requestAccessToken()
  })
}

export function signOut() {
  accessToken = null
}
