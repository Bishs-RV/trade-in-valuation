import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { findEvaluationById } from '@/lib/db/evaluations'
import { getMedia } from '@/lib/bishconnect/media'
import { BishConnectNotConfiguredError, MediaServiceError } from '@/lib/bishconnect/errors'
import { tradeMediaSource } from '@/lib/trade-media'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = paramsSchema.safeParse(await params)

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid evaluation id' }, { status: 400 })
  }

  try {
    const evaluation = await findEvaluationById(result.data.id)

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    const media = await getMedia(tradeMediaSource(evaluation))

    return NextResponse.json({ media })
  } catch (error: unknown) {
    if (error instanceof BishConnectNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof MediaServiceError) {
      return NextResponse.json({ error: 'Media service request failed' }, { status: 502 })
    }
    console.error('Error fetching valuation media:', error)
    return NextResponse.json(
      { error: 'Failed to fetch valuation media' },
      { status: 500 }
    )
  }
}
