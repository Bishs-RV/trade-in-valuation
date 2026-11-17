import { describe, expect, it } from 'vitest'
import { TRADE_EVALUATION, TRADE_UNIT, tradeMediaAssociations, tradeMediaSource } from './trade-media'

describe('tradeMediaSource', () => {
  it('queries the unit by VIN when one is known', () => {
    expect(tradeMediaSource({ tradeEvaluationId: 42, vin: '1HGCM82633A004352' })).toEqual({
      media_domain: 'TRADE_UNIT',
      source_id: '1HGCM82633A004352',
    })
  })

  it('queries the evaluation by id when there is no VIN', () => {
    expect(tradeMediaSource({ tradeEvaluationId: 42, vin: null })).toEqual({
      media_domain: 'TRADE_EVALUATION',
      source_id: '42',
    })
  })
})

describe('tradeMediaAssociations', () => {
  it('tags uploads with the unit and the evaluation when a VIN is known', () => {
    expect(tradeMediaAssociations({ tradeEvaluationId: 42, vin: '1HGCM82633A004352' })).toEqual([
      { media_domain: 'TRADE_UNIT', source_id: '1HGCM82633A004352' },
      { media_domain: 'TRADE_EVALUATION', source_id: '42' },
    ])
  })

  it('tags uploads with only the evaluation when there is no VIN', () => {
    expect(tradeMediaAssociations({ tradeEvaluationId: 42, vin: null })).toEqual([
      { media_domain: 'TRADE_EVALUATION', source_id: '42' },
    ])
  })
})

describe('media domain names', () => {
  it('are the exact uppercase strings the media service expects on save', () => {
    expect(TRADE_UNIT).toBe('TRADE_UNIT')
    expect(TRADE_EVALUATION).toBe('TRADE_EVALUATION')
  })
})
