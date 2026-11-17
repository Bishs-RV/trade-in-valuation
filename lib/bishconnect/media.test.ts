import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMedia } from './media'
import { BishConnectNotConfiguredError, MediaServiceError } from './errors'

vi.mock('./auth', () => ({
  getBishConnectToken: vi.fn(async () => 'test-token'),
}))

const configure = () => {
  vi.stubEnv('BISHCONNECT_API_URL', 'https://api.example.com')
  vi.stubEnv('BISHCONNECT_AUTH_URL', 'https://auth.example.com/oauth2/token')
  vi.stubEnv('BISHCONNECT_CLIENT_ID', 'client-id')
  vi.stubEnv('BISHCONNECT_CLIENT_SECRET', 'client-secret')
}

const metaData = {
  user: { user_email: 'rep@bishs.com', user_id: 'rep-1' },
  media: {
    media_id: 'media-1',
    media_type: 'IMAGE',
    links: {
      original: { cloudfront_url: 'https://cdn.example.com/photo.jpg' },
      small_thumbnail: { cloudfront_url: 'https://cdn.example.com/photo.jpg?width=100' },
      desktop: { cloudfront_url: null },
      large_thumbnail: null,
      user_requested: [{ cloudfront_url: 'https://cdn.example.com/photo.jpg?width=640' }],
    },
  },
  status: 'COMPLETED',
  associations: [{ media_domain: 'TRADE_UNIT', source_id: '1HGCM82633A004352' }],
  created_date: '2026-11-16T18:00:00Z',
  updated_date: '2026-11-16T18:05:00Z',
}

describe('getMedia', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests media for the domain and source with the bearer token', async () => {
    configure()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ meta_data: [metaData] }) })

    const media = await getMedia({ media_domain: 'TRADE_UNIT', source_id: '1HGCM82633A004352' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/media-service/media?media_domain=TRADE_UNIT&source_id=1HGCM82633A004352',
      { headers: { Authorization: 'Bearer test-token', Accept: 'application/json' } }
    )
    expect(media).toEqual([
      {
        media_id: 'media-1',
        media_type: 'IMAGE',
        status: 'COMPLETED',
        links: {
          original: 'https://cdn.example.com/photo.jpg',
          small_thumbnail: 'https://cdn.example.com/photo.jpg?width=100',
        },
        uploaded_by: 'rep@bishs.com',
        created_date: '2026-11-16T18:00:00Z',
      },
    ])
  })

  it('skips a rendition the service returns as null', async () => {
    configure()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        meta_data: [
          {
            ...metaData,
            media: {
              ...metaData.media,
              links: { original: { cloudfront_url: 'https://cdn.example.com/photo.jpg' }, mobile: null },
            },
          },
        ],
      }),
    })

    const [item] = await getMedia({ media_domain: 'TRADE_UNIT', source_id: '1HGCM82633A004352' })

    expect(item.links).toEqual({ original: 'https://cdn.example.com/photo.jpg' })
  })

  it('returns an empty links map when the service has no links yet', async () => {
    configure()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ meta_data: [{ ...metaData, status: 'INITIAL', media: { ...metaData.media, links: null } }] }),
    })

    const media = await getMedia({ media_domain: 'TRADE_EVALUATION', source_id: '42' })

    expect(media).toEqual([
      {
        media_id: 'media-1',
        media_type: 'IMAGE',
        status: 'INITIAL',
        links: {},
        uploaded_by: 'rep@bishs.com',
        created_date: '2026-11-16T18:00:00Z',
      },
    ])
  })

  it('throws BishConnectNotConfiguredError without calling the service when env is missing', async () => {
    vi.stubEnv('BISHCONNECT_API_URL', 'https://api.example.com')

    await expect(getMedia({ media_domain: 'TRADE_UNIT', source_id: 'VIN' })).rejects.toBeInstanceOf(
      BishConnectNotConfiguredError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws MediaServiceError carrying the upstream status and body', async () => {
    configure()
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })

    const error = await getMedia({ media_domain: 'TRADE_UNIT', source_id: 'VIN' }).catch((e) => e)

    expect(error).toBeInstanceOf(MediaServiceError)
    expect(error.message).toBe('Media service error: 500 boom')
  })
})
