// The media service uppercases domain names on GET but not on POST/PATCH: always send these exact strings
export const TRADE_UNIT = 'TRADE_UNIT'
export const TRADE_EVALUATION = 'TRADE_EVALUATION'

export interface MediaAssociation {
  media_domain: string
  source_id: string
}

interface TradeMediaKeys {
  tradeEvaluationId: number
  vin: string | null
}

// Photos follow the RV across evaluations when a VIN is known; otherwise they stay with the evaluation
export function tradeMediaSource({ tradeEvaluationId, vin }: TradeMediaKeys): MediaAssociation {
  if (vin) {
    return { media_domain: TRADE_UNIT, source_id: vin }
  }
  return { media_domain: TRADE_EVALUATION, source_id: String(tradeEvaluationId) }
}

// Every upload is tagged with the evaluation, plus the unit when a VIN is known
export function tradeMediaAssociations({ tradeEvaluationId, vin }: TradeMediaKeys): MediaAssociation[] {
  const evaluation = { media_domain: TRADE_EVALUATION, source_id: String(tradeEvaluationId) }
  if (vin) {
    return [{ media_domain: TRADE_UNIT, source_id: vin }, evaluation]
  }
  return [evaluation]
}
