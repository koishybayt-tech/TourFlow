import { z } from 'zod'
import { accessibleDeal } from '../../../services/access'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { text } = await body(event, z.object({ text: z.string().trim().min(1, 'Введите текст заметки').max(4000) }))
  const n = await ctx.db.note.create({ data: { organizationId: ctx.organizationId, dealId: deal.id, authorId: ctx.memberId, authorLabel: ctx.name, text } })
  return { id: n.id, text: n.text, author: n.authorLabel, createdAt: n.createdAt }
})
