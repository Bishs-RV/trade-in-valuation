import { pgSchema, bigserial, text, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core'

export const tradeToolSchema = pgSchema('trade_tool')

export const tradeEvaluations = tradeToolSchema.table(
  'trade_evaluations',
  {
    tradeEvaluationId: bigserial('trade_evaluation_id', { mode: 'number' }).primaryKey(),
    customerFirstName: text('customer_first_name'),
    customerLastName: text('customer_last_name'),
    customerPhone: text('customer_phone').notNull(),
    customerEmail: text('customer_email'),
    stockNumber: text('stock_number'),
    location: text('location'),
    year: integer('year'),
    make: text('make'),
    model: text('model'),
    vin: text('vin'),
    rvType: text('rv_type'),
    mileage: integer('mileage'),
    jdPowerModelTrimId: integer('jd_power_model_trim_id'),
    jdPowerManufacturerId: integer('jd_power_manufacturer_id'),
    manufacturer: text('manufacturer'),
    conditionScore: integer('condition_score'),
    majorIssues: text('major_issues'),
    unitAddOns: text('unit_add_ons'),
    additionalPrepCost: numeric('additional_prep_cost', { precision: 10, scale: 2 }),
    avgListingPrice: numeric('avg_listing_price', { precision: 10, scale: 2 }),
    // TODO: tradeInPercent is dead code - slider was removed but field persists for schema stability
    tradeInPercent: numeric('trade_in_percent', { precision: 5, scale: 4 }),
    targetMarginPercent: numeric('target_margin_percent', { precision: 5, scale: 4 }),
    retailPriceSource: text('retail_price_source'),
    customRetailValue: numeric('custom_retail_value', { precision: 10, scale: 2 }),
    jdPowerTradeIn: numeric('jd_power_trade_in', { precision: 10, scale: 2 }),
    jdPowerRetailValue: numeric('jd_power_retail_value', { precision: 10, scale: 2 }),
    pdiCost: numeric('pdi_cost', { precision: 10, scale: 2 }),
    reconCost: numeric('recon_cost', { precision: 10, scale: 2 }),
    soldPrepCost: numeric('sold_prep_cost', { precision: 10, scale: 2 }),
    totalPrepCosts: numeric('total_prep_costs', { precision: 10, scale: 2 }),
    bishTivBase: numeric('bish_tiv_base', { precision: 10, scale: 2 }),
    totalUnitCosts: numeric('total_unit_costs', { precision: 10, scale: 2 }),
    avgCompPrice: numeric('avg_comp_price', { precision: 10, scale: 2 }),
    calculatedRetailPrice: numeric('calculated_retail_price', { precision: 10, scale: 2 }),
    replacementCost: numeric('replacement_cost', { precision: 10, scale: 2 }),
    activeRetailPrice: numeric('active_retail_price', { precision: 10, scale: 2 }),
    finalTradeOffer: numeric('final_trade_offer', { precision: 10, scale: 2 }),
    calculatedMarginAmount: numeric('calculated_margin_amount', { precision: 10, scale: 2 }),
    calculatedMarginPercent: numeric('calculated_margin_percent', { precision: 5, scale: 4 }),
    valuationNotes: text('valuation_notes'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdDate: timestamp('created_date', { withTimezone: true }).defaultNow().notNull(),
    updatedDate: timestamp('updated_date', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_trade_evaluations_vin').on(table.vin),
    index('idx_trade_evaluations_stock_number').on(table.stockNumber),
    index('idx_trade_evaluations_created_date').on(table.createdDate),
  ]
)

export type TradeEvaluation = typeof tradeEvaluations.$inferSelect
export type NewTradeEvaluation = typeof tradeEvaluations.$inferInsert

// Re-export evo tables for comparables feature
export * from './schema/evo-units'

// Re-export location detail table
export * from './schema/location-detail'

// Re-export UKG employee view
export * from './schema/ukg-employee'

// Re-export EVO dealer table
export * from './schema/evo-dealer'
