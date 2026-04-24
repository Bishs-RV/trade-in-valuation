import type { TradeData, CalculatedValues } from './types';

interface SaveValuationParams {
  data: TradeData;
  calculated: CalculatedValues;
  userEmail: string;
}

interface SaveValuationResult {
  evaluationId: number;
}

export async function saveValuation({
  data,
  calculated,
  userEmail,
}: SaveValuationParams): Promise<SaveValuationResult> {
  const payload = {
    customerFirstName: data.customerFirstName || undefined,
    customerLastName: data.customerLastName || undefined,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail || undefined,
    stockNumber: data.stockNumber || undefined,
    location: data.location || undefined,
    year: data.year || undefined,
    make: data.make || undefined,
    model: data.model || undefined,
    vin: data.vin || undefined,
    rvType: data.rvType || undefined,
    mileage: data.mileage || undefined,
    jdPowerModelTrimId: data.jdPowerModelTrimId || undefined,
    jdPowerManufacturerId: data.jdPowerManufacturerId || undefined,
    manufacturer: data.manufacturerName || undefined,
    conditionScore: data.conditionScore,
    majorIssues: data.majorIssues || undefined,
    unitAddOns: data.unitAddOns || undefined,
    additionalPrepCost: data.additionalPrepCost,
    avgListingPrice: data.avgListingPrice,
    tradeInPercent: data.tradeInPercent,
    targetMarginPercent: data.targetMarginPercent,
    retailPriceSource: data.retailPriceSource,
    customRetailValue: data.customRetailValue,
    jdPowerTradeIn: calculated.jdPowerTradeIn,
    jdPowerRetailValue: calculated.jdPowerRetailValue,
    pdiCost: calculated.pdiCost,
    reconCost: calculated.reconCost,
    soldPrepCost: calculated.soldPrepCost,
    totalPrepCosts: calculated.totalPrepCosts,
    bishTivBase: calculated.bishTIVBase,
    totalUnitCosts: calculated.totalUnitCosts,
    avgCompPrice: calculated.avgCompPrice,
    calculatedRetailPrice: calculated.calculatedRetailPrice,
    replacementCost: calculated.replacementCost,
    activeRetailPrice: calculated.activeRetailPrice,
    finalTradeOffer: calculated.finalTradeOffer,
    calculatedMarginAmount: calculated.calculatedMarginAmount,
    calculatedMarginPercent: calculated.calculatedMarginPercent,
    valuationNotes: data.valuationNotes || undefined,
    createdBy: userEmail,
  };

  const response = await fetch('/api/valuations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to save valuation';
    try {
      const error = await response.json();
      if (error.details) {
        const fields = Object.entries(error.details)
          .map(
            ([field, messages]) =>
              `${field}: ${(messages as string[]).join(', ')}`
          )
          .join('; ');
        errorMessage = fields || error.error || errorMessage;
      } else {
        errorMessage = error.error || errorMessage;
      }
    } catch {
      // Response body is not valid JSON
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  if (!result.evaluation?.tradeEvaluationId) {
    throw new Error('Invalid response from server');
  }

  return { evaluationId: result.evaluation.tradeEvaluationId };
}
