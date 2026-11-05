import { z } from 'zod'
import { uniqueSlug } from '../../services/tours'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const { name } = await body(event, z.object({ name: z.string().trim().min(2, 'Назовите тур') }))
  const t = await ctx.db.tour.create({
    data: {
      organizationId: ctx.organizationId, slug: await uniqueSlug(ctx.db, name), name, countries: [], route: '', seats: 15, price: 0, prepay: 150_000,
      description: '', included: ['Проживание', 'Услуги гида'], extra: ['Питание', 'Личные расходы'], rates: { EUR: 545, USD: 505, CHF: 585 }, ratesFixedAt: new Date(),
      costs: { create: [{ order: 0, category: 'Непредвиденные расходы', plan: 5, unit: 'PERCENT', per: 'group' }] },
    },
  })
  return { id: t.id }
})
