import { eq } from 'drizzle-orm'
import { db } from './index'
import { tradeEvaluations, type TradeEvaluation } from './schema'

export async function findEvaluationById(id: number): Promise<TradeEvaluation | null> {
  const [evaluation] = await db
    .select()
    .from(tradeEvaluations)
    .where(eq(tradeEvaluations.tradeEvaluationId, id))
    .limit(1)

  return evaluation ?? null
}
