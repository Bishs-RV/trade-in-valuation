import {
  pgTable,
  varchar,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * EVO tables live in the 'public' PostgreSQL schema (not trade_tool).
 * These are read-only tables synced from the EVO system.
 * Timestamps use mode: 'string' as these are legacy external data.
 */

/**
 * evo_majorunit - Current inventory (listed units)
 * Schema: public
 * Only includes columns needed for comparables feature
 */
export const evoMajorunit = pgTable(
  'evo_majorunit',
  {
    majorUnitHeaderId: integer('MajorUnitHeaderId').primaryKey().notNull(),
    make: varchar('Make', { length: 255 }),
    model: varchar('Model', { length: 255 }),
    modelYear: integer('ModelYear'),
    manufacturer: varchar('Manufacturer', { length: 255 }),
    location: varchar('Location', { length: 255 }),
    storeLocation: varchar('StoreLocation', { length: 255 }),
    cmfId: varchar('Cmf_id', { length: 255 }),
    webPrice: numeric('WebPrice', { precision: 19, scale: 2 }),
    dsrp: numeric('DSRP', { precision: 19, scale: 2 }),
    dateReceived: timestamp('DateReceived', { withTimezone: true, mode: 'string' }),
    stockNumber: varchar('StockNumber', { length: 255 }),
    vin: varchar('VIN', { length: 255 }),
    newUsed: varchar('NewUsed', { length: 255 }),
    unitClass: varchar('Class', { length: 255 }),
  },
  (table) => [
    index('idx_evo_majorunit_make_model').on(table.make, table.model),
  ]
)

/**
 * evo_salesdealdetail - Deal header info (has sold date)
 * Schema: public
 * Only includes columns needed for comparables feature
 */
export const evoSalesdealdetail = pgTable(
  'evo_salesdealdetail',
  {
    dealNoCmf: varchar('DealNoCmf', { length: 255 }).primaryKey().notNull(),
    dealNo: varchar('DealNo', { length: 255 }),
    dealerId: varchar('DealerId', { length: 255 }),
    cmfId: varchar('Cmf_id', { length: 255 }),
    deliveryDate: timestamp('DeliveryDate', { withTimezone: true, mode: 'string' }),
    stageName: varchar('stagename', { length: 255 }),
  }
)

/**
 * evo_salesdealdetailunits - Sold unit details (has days in store)
 * Schema: public
 * Only includes columns needed for comparables feature
 */
export const evoSalesdealdetailunits = pgTable(
  'evo_salesdealdetailunits',
  {
    dealUnitId: integer('DealUnitId').primaryKey().notNull(),
    dealerId: varchar('DealerId', { length: 255 }),
    make: varchar('Make', { length: 255 }),
    model: varchar('Model', { length: 255 }),
    year: varchar('Year', { length: 255 }),
    manufacturer: varchar({ length: 255 }),
    newused: varchar('Newused', { length: 255 }),
    unitPrice: numeric('Unitprice', { precision: 19, scale: 2 }),
    daysInStore: integer('DaysInStore'),
    dateReceived: timestamp('DateReceived', { withTimezone: true, mode: 'string' }),
    salesDealId: varchar('SalesDeal_id', { length: 255 }).notNull(),
    stocknumber: varchar({ length: 255 }),
    vin: varchar('VIN', { length: 255 }),
    unitClass: varchar('Class', { length: 255 }),
  },
  (table) => [
    index('idx_evo_salesdealdetailunits_make_model').on(table.make, table.model),
    index('idx_evo_salesdealdetailunits_sales_deal_id').on(table.salesDealId),
  ]
)

/**
 * evo_soldunit - Historical sold units
 * Schema: public
 * Only includes columns needed for comparables feature
 */
export const evoSoldunit = pgTable(
  'evo_soldunit',
  {
    majorUnitHeaderId: integer('MajorUnitHeaderId').primaryKey().notNull(),
    make: varchar('Make', { length: 255 }),
    model: varchar('Model', { length: 255 }),
    modelYear: integer('ModelYear'),
    manufacturer: varchar('Manufacturer', { length: 255 }),
    cmf: varchar('Cmf', { length: 255 }),
    storeLocation: varchar('StoreLocation', { length: 255 }),
    stockNumber: varchar('StockNumber', { length: 255 }),
    vin: varchar('VIN', { length: 255 }),
    newUsed: varchar('NewUsed', { length: 255 }),
    dateReceived: timestamp('DateReceived', { withTimezone: true, mode: 'string' }),
    webPrice: numeric('WebPrice', { precision: 19, scale: 2 }),
  },
  (table) => [
    index('idx_evo_soldunit_make_model').on(table.make, table.model),
  ]
)

export type EvoMajorunit = typeof evoMajorunit.$inferSelect
export type EvoSalesdealdetail = typeof evoSalesdealdetail.$inferSelect
export type EvoSalesdealdetailunits = typeof evoSalesdealdetailunits.$inferSelect
export type EvoSoldunit = typeof evoSoldunit.$inferSelect
