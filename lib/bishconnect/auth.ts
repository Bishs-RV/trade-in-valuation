interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

// Token cache
let cachedToken: TokenResponse | null = null
let tokenExpiry: number = 0

/**
 * Get an OAuth2 token response using client credentials flow
 * Caches the token until 5 minutes before expiry
 */
export async function getBishConnectTokenResponse(): Promise<TokenResponse> {
  const now = Date.now()

  // Return cached token if still valid
  if (cachedToken && now < tokenExpiry) {
    return cachedToken
  }

  const authUrl = process.env.BISHCONNECT_AUTH_URL
  const clientId = process.env.BISHCONNECT_CLIENT_ID
  const clientSecret = process.env.BISHCONNECT_CLIENT_SECRET

  if (!authUrl) {
    throw new Error('BISHCONNECT_AUTH_URL must be set')
  }
  if (!clientId) {
    throw new Error('BISHCONNECT_CLIENT_ID must be set')
  }
  if (!clientSecret) {
    throw new Error('BISHCONNECT_CLIENT_SECRET must be set')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`BishConnect auth error: ${response.status} ${response.statusText} - ${errorBody}`)
  }

  const data = (await response.json()) as TokenResponse

  // Cache the token with 5-minute buffer before expiry
  cachedToken = data
  tokenExpiry = now + (data.expires_in - 300) * 1000

  return cachedToken
}

/**
 * Get just the access token (most callers only need the bearer string)
 */
export async function getBishConnectToken(): Promise<string> {
  const { access_token } = await getBishConnectTokenResponse()
  return access_token
}
