import { z } from 'zod'
import { accessibleDeal } from '../../../services/access'
import { logDeal, notify } from '../../../services/deals'

/** Owner reassigns the deal; open system tasks move to the new manager. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals.reassign')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { managerId } = await body(event, z.object({ managerId: z.string().nullable() }))
  const m = managerId ? await ctx.db.member.findFirst({ where: { id: managerId, active: true }, include: { user: { select: { name: true } } } }) : null
  if (managerId && !m) notFound('Сотрудник')
  await ctx.db.deal.update({ where: { id: deal.id }, data: { managerId } })
  await ctx.db.task.updateMany({ where: { dealId: deal.id, isSystem: true, status: { not: 'DONE' } }, data: { assigneeId: managerId } })
  await logDeal(ctx, deal.id, 'system', `Ответственный: ${m?.user.name ?? 'не назначен'}`)
  if (managerId && managerId !== ctx.memberId) await notify(ctx.organizationId, managerId, 'Вам передана заявка', `№${deal.number} · ${deal.title}`, `/deals/${deal.id}`)
  return { ok: true }
})
