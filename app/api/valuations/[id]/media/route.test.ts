import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { findEvaluationById } from '@/lib/db/evaluations'
import { getMedia } from '@/lib/bishconnect/media'
import { BishConnectNotConfiguredError, MediaServiceError } from '@/lib/bishconnect/errors'
import type { TradeEvaluation } from '@/lib/db/schema'

vi.mock('@/lib/db/evaluations', () => ({
  findEvaluationById: vi.fn(),
}))

vi.mock('@/lib/bishconnect/media', () => ({
  getMedia: vi.fn(),
}))

const get = (id: string) =>
  GET(new NextRequest(`http://localhost/api/valuations/${id}/media`), { params: Promise.resolve({ id }) })

const withVin = { tradeEvaluationId: 42, vin: '1HGCM82633A004352' } as TradeEvaluation
const withoutVin = { tradeEvaluationId: 42, vin: null } as TradeEvaluation

const mediaItem = {
  media_id: 'media-1',
  media_type: 'IMAGE',
  status: 'COMPLETED',
  links: { original: 'https://cdn.example.com/photo.jpg' },
  uploaded_by: 'rep@bishs.com',
  created_date: '2026-11-16T18:00:00Z',
}

describe('GET /api/valuations/[id]/media', () => {
  afterEach(() => {
    vi.mocked(findEvaluationById).mockReset()
    vi.mocked(getMedia).mockReset()
    vi.restoreAllMocks()
  })

  it('returns 400 for a non-numeric id without touching the database', async () => {
    const response = await get('abc')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid evaluation id' })
    expect(findEvaluationById).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown id without calling the media service', async () => {
    vi.mocked(findEvaluationById).mockResolvedValue(null)

    const response = await get('42')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Evaluation not found' })
    expect(getMedia).not.toHaveBeenCalled()
  })

  it('returns 503 when BishConnect is not configured', async () => {
    vi.mocked(findEvaluationById).mockResolvedValue(withVin)
    vi.mocked(getMedia).mockRejectedValue(new BishConnectNotConfiguredError())

    const response = await get('42')

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error:
        'BishConnect is not configured: set BISHCONNECT_API_URL, BISHCONNECT_AUTH_URL, BISHCONNECT_CLIENT_ID and BISHCONNECT_CLIENT_SECRET',
    })
  })

  it('returns 502 when the media service fails', async () => {
    vi.mocked(findEvaluationById).mockResolvedValue(withVin)
    vi.mocked(getMedia).mockRejectedValue(new MediaServiceError(500, 'boom'))

    const response = await get('42')

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Media service request failed' })
  })

  it('returns 500 on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(findEvaluationById).mockRejectedValue(new Error('connection refused'))

    const response = await get('42')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch valuation media' })
  })

  it('queries the unit by VIN when the evaluation has one', async () => {
    vi.mocked(findEvaluationById).mockResolvedValue(withVin)
    vi.mocked(getMedia).mockResolvedValue([mediaItem])

    const response = await get('42')

    expect(getMedia).toHaveBeenCalledWith({ media_domain: 'TRADE_UNIT', source_id: '1HGCM82633A004352' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ media: [mediaItem] })
  })

  it('queries the evaluation by id when there is no VIN', async () => {
    vi.mocked(findEvaluationById).mockResolvedValue(withoutVin)
    vi.mocked(getMedia).mockResolvedValue([])

    const response = await get('42')

    expect(getMedia).toHaveBeenCalledWith({ media_domain: 'TRADE_EVALUATION', source_id: '42' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ media: [] })
  })
})
