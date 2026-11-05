import { formatMoney } from '#shared/utils/money'
import { currentPrice } from '../providers/travel'
import { notify } from '../services/deals'
import { prisma } from '../utils/prisma'

/** Checks all price watches; notifies the owner of a watch when the price drops. */
export async function runPriceWatch() {
  const watches = await prisma.priceWatch.findMany()
  let dropped = 0
  for (const w of watches) {
    const q = w.query as Record<string, string>
    const price = currentPrice(w.kind as 'flight' | 'hotel', q)
    if (price && price < w.lastPrice) {
      const member = await prisma.member.findFirst({ where: { organizationId: w.organizationId, userId: w.userId, active: true } })
      const what = w.kind === 'flight' ? `${q.from} → ${q.to}, ${q.depart}` : `${q.city}, ${q.checkIn}`
      await notify(w.organizationId, member?.id, 'Цена снизилась', `${what}: ${formatMoney(w.lastPrice)} → ${formatMoney(price)}`, '/tickets')
      dropped++
    }
    if (price !== w.lastPrice) await prisma.priceWatch.update({ where: { id: w.id }, data: { lastPrice: price } })
  }
  return { checked: watches.length, dropped }
}
