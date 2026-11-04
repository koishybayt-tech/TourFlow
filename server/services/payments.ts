import type { ScopedDb } from '../utils/db'

/** Sum of payments per deal (refunds are negative). */
export async function paidByDeal(db: ScopedDb, dealIds: string[]): Promise<Record<string, number>> {
  if (!dealIds.length) return {}
  const rows = await db.payment.groupBy({ by: ['dealId'], where: { dealId: { in: dealIds } }, _sum: { amount: true } })
  return Object.fromEntries(rows.map(r => [r.dealId, r._sum.amount ?? 0]))
}
