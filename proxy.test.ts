import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getAuthToken } from '@/app/actions/auth'

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

vi.mock('@/app/actions/auth', () => ({
  getAuthToken: vi.fn(async () => ({ access_token: 'test-token', expires_in: 3600, token_type: 'Bearer' })),
}))

const configureBishConnect = () => {
  vi.stubEnv('BISHCONNECT_API_URL', 'https://api.example.com')
  vi.stubEnv('BISHCONNECT_AUTH_URL', 'https://auth.example.com/oauth2/token')
  vi.stubEnv('BISHCONNECT_CLIENT_ID', 'client-id')
  vi.stubEnv('BISHCONNECT_CLIENT_SECRET', 'client-secret')
}

const configureAzureAD = () => {
  vi.stubEnv('AZURE_AD_CLIENT_ID', 'azure-client')
  vi.stubEnv('AZURE_AD_CLIENT_SECRET', 'azure-secret')
  vi.stubEnv('AZURE_AD_TENANT_ID', 'azure-tenant')
}

// proxy.ts reads env at module load, so each test imports a fresh copy after stubbing
const loadProxy = async () => {
  vi.resetModules()
  return (await import('./proxy')).proxy
}

const mediaUrl = 'http://localhost/api/media?media_domain=TRADE_UNIT&source_id=1HGCM82633A004352'

describe('proxy', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.mocked(getToken).mockReset()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('/api/media', () => {
    it('refuses DELETE with 405 for everyone, even unauthenticated and unconfigured', async () => {
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest('http://localhost/api/media/media-1', { method: 'DELETE' }))

      expect(response.status).toBe(405)
      expect(response.headers.get('Allow')).toBe('GET, POST, PATCH')
      expect(await response.json()).toEqual({ error: 'Deleting media is not supported' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns 503 when BishConnect env is missing', async () => {
      vi.stubEnv('BISHCONNECT_API_URL', 'https://api.example.com')
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest(mediaUrl))

      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        error:
          'Media service is not configured: set BISHCONNECT_API_URL, BISHCONNECT_AUTH_URL, BISHCONNECT_CLIENT_ID and BISHCONNECT_CLIENT_SECRET',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns 401 instead of redirecting when Azure AD is on and there is no session', async () => {
      configureBishConnect()
      configureAzureAD()
      vi.mocked(getToken).mockResolvedValue(null)
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest(mediaUrl))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Not authenticated' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forwards to the media service with the BishConnect bearer token', async () => {
      configureBishConnect()
      fetchMock.mockResolvedValue(
        new Response('{"meta_data":[]}', { status: 200, headers: { 'content-type': 'application/json' } })
      )
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest(mediaUrl))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/media-service/media?media_domain=TRADE_UNIT&source_id=1HGCM82633A004352',
        { method: 'GET', headers: { Authorization: 'Bearer test-token' }, body: undefined }
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ meta_data: [] })
    })

    it('forwards presigned-url POSTs with the body and content type', async () => {
      configureBishConnect()
      configureAzureAD()
      vi.mocked(getToken).mockResolvedValue({ sub: 'user-1' })
      fetchMock.mockResolvedValue(
        new Response('{"presigned_posts":[]}', { status: 200, headers: { 'content-type': 'application/json' } })
      )
      const proxy = await loadProxy()

      const body = JSON.stringify({ user_email: 'rep@bishs.com', files: [], associations: [] })
      const response = await proxy(
        new NextRequest('http://localhost/api/media/presigned-url', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        })
      )

      expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/media-service/presigned-url', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
        body,
      })
      expect(response.status).toBe(200)
    })

    it('returns 500 with a generic message and logs the cause when the token request fails', async () => {
      configureBishConnect()
      const cause = new Error('BishConnect auth error: 401 Unauthorized - {"error":"invalid_client"}')
      vi.mocked(getAuthToken).mockRejectedValueOnce(cause)
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest(mediaUrl))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Proxy error', message: 'BishConnect token request failed' })
      expect(consoleError).toHaveBeenCalledWith('BishConnect token request failed:', cause)
      expect(fetchMock).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('other paths', () => {
    it('passes through when Azure AD is not configured', async () => {
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest('http://localhost/'))

      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(getToken).not.toHaveBeenCalled()
    })

    it('redirects to sign-in when Azure AD is configured and there is no session', async () => {
      configureAzureAD()
      vi.mocked(getToken).mockResolvedValue(null)
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest('http://localhost/'))

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/api/auth/signin?callbackUrl=http%3A%2F%2Flocalhost%2F'
      )
    })

    it('passes through when Azure AD is configured and there is a session', async () => {
      configureAzureAD()
      vi.mocked(getToken).mockResolvedValue({ sub: 'user-1' })
      const proxy = await loadProxy()

      const response = await proxy(new NextRequest('http://localhost/'))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })
  })
})
