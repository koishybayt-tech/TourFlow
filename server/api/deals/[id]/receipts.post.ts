import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { accessibleDeal } from '../../../services/access'
import { createContract, signLinks } from '../../../services/contracts'

/** «Отправить рекомендуемые · N»: several receipts, one link for the client. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { templateIds } = await body(event, z.object({ templateIds: z.array(z.string()).min(1, 'Выберите расписки') }))
  const bundle = templateIds.length > 1 ? randomUUID() : undefined
  const created = []
  for (const id of templateIds) created.push(await createContract(ctx, deal.id, id, {}, { bundle }))
  return { count: created.length, links: signLinks(created[0]!) }
})
