import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evoMajorunit, evoSalesdealdetail, evoSalesdealdetailunits, locationDetail } from '@/lib/db/schema'
import { and, eq, gte, lte, ilike, not, sql, or, isNotNull, desc, asc } from 'drizzle-orm'
import type { ComparablesResponse, HistoricalComparable } from '@/lib/types/comparables'

const DEFAULT_YEAR_RANGE = 1
const MAX_YEAR_RANGE = 5

// Map POC rvType codes to EVO class column values
// EVO uses simplified codes: CAG/CAD → A, CCG/CCD → C
const RV_TYPE_TO_EVO_CLASS: Record<string, string> = {
  TT: 'TT',
  FW: 'FW',
  POP: 'POP',
  TC: 'TC',
  CAG: 'A',
  CAD: 'A',
  CCG: 'C',
  CCD: 'C',
  DT: 'DT',
}

const NOISE_WORDS = new Set([
  'series', 'by', 'inc', 'llc', 'corp', 'corporation', 'co', 'company',
  'rv', 'rvs', 'trailer', 'trailers', 'motorhome', 'motorhomes',
  'industries', 'manufacturing', 'mfg',
])

function buildFuzzyPattern(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')

  const words = normalized
    .split(' ')
    .filter(w => w.length > 1 && !NOISE_WORDS.has(w))

  if (words.length === 0) {
    return `%${normalized}%`
  }

  return `%${words[0]}%`
}

function buildModelPattern(input: string): string {
  const normalized = input.toLowerCase().trim()
  // Split into segments and find the longest alphanumeric segment
  // "M-273QBXL" -> ["m", "273qbxl"] -> use "273qbxl"
  // This handles cases where JD Power has prefixes the DB doesn't
  const segments = normalized.split(/[^a-z0-9]+/).filter(s => s.length > 0)
  const longest = segments.length > 0
    ? segments.reduce((a, b) => a.length >= b.length ? a : b)
    : normalized.replace(/[^a-z0-9]/g, '')
  return `%${longest}%`
}

function parseNumeric(value: string | null): number | null {
  if (!value) return null
  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

function avgOf(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function buildMakeManufacturerFilter(
  makeField: Parameters<typeof ilike>[0],
  manufacturerField: Parameters<typeof ilike>[0],
  makePattern: string | null,
  manufacturerPattern: string | null,
) {
  return or(
    makePattern ? ilike(makeField, makePattern) : undefined,
    manufacturerPattern ? ilike(makeField, manufacturerPattern) : undefined,
    makePattern ? ilike(manufacturerField, makePattern) : undefined,
    manufacturerPattern ? ilike(manufacturerField, manufacturerPattern) : undefined,
  )
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const make = searchParams.get('make')
  const model = searchParams.get('model')
  const manufacturer = searchParams.get('manufacturer')
  const yearStr = searchParams.get('year')
  const yearRangeStr = searchParams.get('yearRange')
  const rvType = searchParams.get('rvType')

  if (!model || !yearStr || (!make && !manufacturer)) {
    return NextResponse.json(
      { error: 'model, year, and at least one of make/manufacturer are required' },
      { status: 400 }
    )
  }

  const year = parseInt(yearStr, 10)
  if (isNaN(year)) {
    return NextResponse.json(
      { error: 'year must be a valid number' },
      { status: 400 }
    )
  }

  let yearRange = yearRangeStr ? parseInt(yearRangeStr, 10) : DEFAULT_YEAR_RANGE
  if (isNaN(yearRange) || yearRange < 0 || yearRange > MAX_YEAR_RANGE) {
    yearRange = DEFAULT_YEAR_RANGE
  }

  const evoClass = rvType ? RV_TYPE_TO_EVO_CLASS[rvType] ?? null : null

  const minYear = year - yearRange
  const maxYear = year + yearRange
  const makePattern = make ? buildFuzzyPattern(make) : null
  const manufacturerPattern = manufacturer ? buildFuzzyPattern(manufacturer) : null
  const modelPattern = buildModelPattern(model)

  try {
    // Use REGEXP_REPLACE to normalize DB values for comparison
    // This allows "M-19" in DB to match pattern "%m19%"
    // Join to location_detail to get proper location code from Cmf_id
    // Include Days on Lot calculation for currently listed units
    const listedUnitsRaw = await db
      .select({
        id: evoMajorunit.majorUnitHeaderId,
        make: evoMajorunit.make,
        model: evoMajorunit.model,
        year: evoMajorunit.modelYear,
        manufacturer: evoMajorunit.manufacturer,
        location: locationDetail.location,
        webPrice: evoMajorunit.webPrice,
        dsrp: evoMajorunit.dsrp,
        listingDate: evoMajorunit.dateReceived,
        stockNumber: evoMajorunit.stockNumber,
        vin: evoMajorunit.vin,
        newUsed: evoMajorunit.newUsed,
        region: locationDetail.region,
        unitClass: evoMajorunit.unitClass,
        daysOnLot: sql<number | null>`(NOW()::date - ${evoMajorunit.dateReceived}::date)`.as('days_on_lot'),
      })
      .from(evoMajorunit)
      .leftJoin(
        locationDetail,
        sql`CAST(${evoMajorunit.cmfId} AS INTEGER) = ${locationDetail.cmf}`
      )
      .where(
        and(
          // Flexible manufacturer/make matching - check both fields with both patterns
          // This handles cases where JD Power "Flagstaff by Forest River" maps to DB "FOREST RIVER" manufacturer + "FLAGSTAFF CLASSIC" make
          buildMakeManufacturerFilter(evoMajorunit.make, evoMajorunit.manufacturer, makePattern, manufacturerPattern),
          sql`LOWER(REGEXP_REPLACE(${evoMajorunit.model}, '[^a-zA-Z0-9]', '', 'g')) LIKE ${modelPattern}`,
          gte(evoMajorunit.modelYear, minYear),
          lte(evoMajorunit.modelYear, maxYear),
          or(isNotNull(evoMajorunit.webPrice), isNotNull(evoMajorunit.dsrp)),
          not(ilike(evoMajorunit.stockNumber, 'L%')),
          evoClass ? eq(evoMajorunit.unitClass, evoClass) : undefined,
        )
      )
      .orderBy(desc(evoMajorunit.modelYear), asc(locationDetail.location))

    // Query 1: Sold units from deal details (has soldPrice, soldDate)
    // Join to location_detail to get proper location code from cmfId
    // Calculate days to sale as: deliveryDate - dateReceived
    const soldFromDealsRaw = await db
      .select({
        id: evoSalesdealdetailunits.dealUnitId,
        make: evoSalesdealdetailunits.make,
        model: evoSalesdealdetailunits.model,
        year: evoSalesdealdetailunits.year,
        manufacturer: evoSalesdealdetailunits.manufacturer,
        soldPrice: evoSalesdealdetailunits.unitPrice,
        listingDate: evoSalesdealdetailunits.dateReceived,
        stockNumber: evoSalesdealdetailunits.stocknumber,
        vin: evoSalesdealdetailunits.vin,
        newUsed: evoSalesdealdetailunits.newused,
        region: locationDetail.region,
        unitClass: evoSalesdealdetailunits.unitClass,
        salesDealId: evoSalesdealdetailunits.salesDealId,
        soldDate: evoSalesdealdetail.deliveryDate,
        location: locationDetail.location,
        daysToSale: sql<number | null>`(${evoSalesdealdetail.deliveryDate}::date - ${evoSalesdealdetailunits.dateReceived}::date)`.as('days_to_sale'),
      })
      .from(evoSalesdealdetailunits)
      .innerJoin(
        evoSalesdealdetail,
        eq(evoSalesdealdetailunits.salesDealId, evoSalesdealdetail.dealNoCmf)
      )
      .leftJoin(
        locationDetail,
        sql`CAST(${evoSalesdealdetail.cmfId} AS INTEGER) = ${locationDetail.cmf}`
      )
      .where(
        and(
          // Flexible manufacturer/make matching - check both fields with both patterns
          buildMakeManufacturerFilter(evoSalesdealdetailunits.make, evoSalesdealdetailunits.manufacturer, makePattern, manufacturerPattern),
          sql`LOWER(REGEXP_REPLACE(${evoSalesdealdetailunits.model}, '[^a-zA-Z0-9]', '', 'g')) LIKE ${modelPattern}`,
          gte(sql`CAST(${evoSalesdealdetailunits.year} AS INTEGER)`, minYear),
          lte(sql`CAST(${evoSalesdealdetailunits.year} AS INTEGER)`, maxYear),
          isNotNull(evoSalesdealdetailunits.unitPrice),
          eq(evoSalesdealdetail.stageName, 'Delivered'),
          evoClass ? eq(evoSalesdealdetailunits.unitClass, evoClass) : undefined,
        )
      )
      .orderBy(desc(sql`CAST(${evoSalesdealdetailunits.year} AS INTEGER)`), asc(locationDetail.location))

    const listedUnits: HistoricalComparable[] = listedUnitsRaw.map(unit => ({
      id: String(unit.id),
      make: unit.make,
      model: unit.model,
      year: unit.year,
      manufacturer: unit.manufacturer,
      location: unit.location,
      listedPrice: parseNumeric(unit.webPrice) ?? parseNumeric(unit.dsrp),
      soldPrice: null,
      soldDate: null,
      listingDate: unit.listingDate,
      daysToSale: null,
      daysOnLot: unit.daysOnLot,
      stockNumber: unit.stockNumber,
      vin: unit.vin,
      newUsed: unit.newUsed ?? null,
      region: unit.region ?? null,
      unitClass: unit.unitClass ?? null,
    }))

    const soldUnits: HistoricalComparable[] = soldFromDealsRaw.map(unit => ({
      id: String(unit.id),
      make: unit.make,
      model: unit.model,
      year: parseNumeric(unit.year),
      manufacturer: unit.manufacturer,
      location: unit.location,
      listedPrice: null,
      soldPrice: parseNumeric(unit.soldPrice),
      soldDate: unit.soldDate,
      listingDate: unit.listingDate,
      daysToSale: unit.daysToSale,
      daysOnLot: null,
      stockNumber: unit.stockNumber,
      vin: unit.vin,
      newUsed: unit.newUsed ?? null,
      region: unit.region ?? null,
      unitClass: unit.unitClass ?? null,
    }))

    const listedPrices = listedUnits.map(u => u.listedPrice).filter((p): p is number => p !== null)
    const soldPrices = soldUnits.map(u => u.soldPrice).filter((p): p is number => p !== null)
    const daysToSaleValues = soldUnits.map(u => u.daysToSale).filter((d): d is number => d !== null)

    const avgListedPrice = avgOf(listedPrices)
    const avgSoldPrice = avgOf(soldPrices)
    const rawAvgDays = avgOf(daysToSaleValues)
    const avgDaysToSale = rawAvgDays !== null ? Math.round(rawAvgDays) : null

    const response: ComparablesResponse = {
      listedUnits,
      soldUnits,
      metrics: {
        avgListedPrice,
        avgSoldPrice,
        avgDaysToSale,
        listedCount: listedUnits.length,
        soldCount: soldUnits.length,
      },
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching comparables:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to fetch comparable units' },
      { status: 500 }
    )
  }
}
