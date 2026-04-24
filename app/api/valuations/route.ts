import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tradeEvaluations } from '@/lib/db/schema'
import { z } from 'zod'
import { or, ilike, desc } from 'drizzle-orm'

const createValuationSchema = z.object({
  // Customer Info (phone is required)
  customerFirstName: z.string().optional(),
  customerLastName: z.string().optional(),
  customerPhone: z.string().min(1, 'Phone is required'),
  customerEmail: z.union([z.string().email(), z.literal('')]).optional(),

  // Unit Data
  stockNumber: z.string().optional(),
  location: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  vin: z.string().optional(),
  rvType: z.string().optional(),
  mileage: z.number().int().min(0).optional(),

  // JD Power Data
  jdPowerModelTrimId: z.number().int().optional(),
  jdPowerManufacturerId: z.number().int().optional(),
  manufacturer: z.string().optional(),

  // Condition Data
  conditionScore: z.number().int().min(1).max(10).optional(),
  majorIssues: z.string().optional(),
  unitAddOns: z.string().optional(),
  additionalPrepCost: z.number().min(0).optional(),

  // Market Data
  avgListingPrice: z.number().min(0).optional(),

  // Valuation Inputs
  tradeInPercent: z.number().max(2).optional(),
  targetMarginPercent: z.number().max(1).optional(),
  retailPriceSource: z.string().optional(),
  customRetailValue: z.number().min(0).optional(),

  // Calculated Outputs
  jdPowerTradeIn: z.number().optional(),
  jdPowerRetailValue: z.number().optional(),
  pdiCost: z.number().optional(),
  reconCost: z.number().optional(),
  soldPrepCost: z.number().optional(),
  totalPrepCosts: z.number().optional(),
  bishTivBase: z.number().optional(),
  totalUnitCosts: z.number().optional(),
  avgCompPrice: z.number().optional(),
  calculatedRetailPrice: z.number().optional(),
  replacementCost: z.number().optional(),
  activeRetailPrice: z.number().optional(),
  finalTradeOffer: z.number().optional(),
  calculatedMarginAmount: z.number().optional(),
  calculatedMarginPercent: z.number().optional(),

  // Notes
  valuationNotes: z.string().optional(),

  // Audit
  createdBy: z.string().min(1),
})

const toStringOrUndefined = (val: number | undefined) => val?.toString()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = createValuationSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = result.data

    const [saved] = await db
      .insert(tradeEvaluations)
      .values({
        ...data,
        customerEmail: data.customerEmail || null,
        additionalPrepCost: toStringOrUndefined(data.additionalPrepCost),
        avgListingPrice: toStringOrUndefined(data.avgListingPrice),
        tradeInPercent: toStringOrUndefined(data.tradeInPercent),
        targetMarginPercent: toStringOrUndefined(data.targetMarginPercent),
        customRetailValue: toStringOrUndefined(data.customRetailValue),
        jdPowerTradeIn: toStringOrUndefined(data.jdPowerTradeIn),
        jdPowerRetailValue: toStringOrUndefined(data.jdPowerRetailValue),
        pdiCost: toStringOrUndefined(data.pdiCost),
        reconCost: toStringOrUndefined(data.reconCost),
        soldPrepCost: toStringOrUndefined(data.soldPrepCost),
        totalPrepCosts: toStringOrUndefined(data.totalPrepCosts),
        bishTivBase: toStringOrUndefined(data.bishTivBase),
        totalUnitCosts: toStringOrUndefined(data.totalUnitCosts),
        avgCompPrice: toStringOrUndefined(data.avgCompPrice),
        calculatedRetailPrice: toStringOrUndefined(data.calculatedRetailPrice),
        replacementCost: toStringOrUndefined(data.replacementCost),
        activeRetailPrice: toStringOrUndefined(data.activeRetailPrice),
        finalTradeOffer: toStringOrUndefined(data.finalTradeOffer),
        calculatedMarginAmount: toStringOrUndefined(data.calculatedMarginAmount),
        calculatedMarginPercent: toStringOrUndefined(data.calculatedMarginPercent),
        updatedBy: data.createdBy,
      })
      .returning()

    return NextResponse.json({ evaluation: saved }, { status: 201 })
  } catch (error: unknown) {
    console.error('Error saving valuation:', error)
    return NextResponse.json(
      { error: 'Failed to save valuation' },
      { status: 500 }
    )
  }
}

const searchSchema = z.object({
  vin: z.string().max(17).optional(),
  stockNumber: z.string().max(50).optional(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
}).refine(data => data.vin || data.stockNumber || data.customerName || data.customerPhone, {
  message: 'At least one search parameter is required',
})

const escapeWildcards = (str: string) => str.replace(/[%_\\]/g, '\\$&')

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const result = searchSchema.safeParse({
      vin: searchParams.get('vin') || undefined,
      stockNumber: searchParams.get('stockNumber') || undefined,
      customerName: searchParams.get('customerName') || undefined,
      customerPhone: searchParams.get('customerPhone') || undefined,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid search parameters' },
        { status: 400 }
      )
    }

    const { vin, stockNumber, customerName, customerPhone } = result.data

    // Build where conditions with escaped wildcards
    const conditions = []
    if (vin) {
      conditions.push(ilike(tradeEvaluations.vin, `%${escapeWildcards(vin)}%`))
    }
    if (stockNumber) {
      conditions.push(ilike(tradeEvaluations.stockNumber, `%${escapeWildcards(stockNumber)}%`))
    }
    if (customerName) {
      const escapedName = escapeWildcards(customerName)
      conditions.push(ilike(tradeEvaluations.customerFirstName, `%${escapedName}%`))
      conditions.push(ilike(tradeEvaluations.customerLastName, `%${escapedName}%`))
    }
    if (customerPhone) {
      // Strip non-digits for phone comparison
      const digitsOnly = customerPhone.replace(/\D/g, '')
      conditions.push(ilike(tradeEvaluations.customerPhone, `%${escapeWildcards(digitsOnly)}%`))
    }

    const evaluations = await db
      .select()
      .from(tradeEvaluations)
      .where(or(...conditions))
      .orderBy(desc(tradeEvaluations.createdDate))
      .limit(20)

    return NextResponse.json({ evaluations })
  } catch (error: unknown) {
    console.error('Error fetching valuations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch valuations' },
      { status: 500 }
    )
  }
}
