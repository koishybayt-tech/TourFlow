import type { AuthContext } from '../utils/auth'
import { dealScope, notFound } from '../utils/auth'

/** Loads a client the current member may see (managers: own clients or clients of their deals). */
export async function accessibleClient(ctx: AuthContext, id: string) {
  const scope = dealScope(ctx)
  const client = await ctx.db.client.findFirst({
    where: { id, deletedAt: null, ...(scope.managerId ? { OR: [{ managerId: ctx.memberId }, { deals: { some: { managerId: ctx.memberId } } }] } : {}) },
  })
  if (!client) notFound('Клиент')
  return client
}

/** Loads a deal the current member may see. */
export async function accessibleDeal(ctx: AuthContext, id: string) {
  const deal = await ctx.db.deal.findFirst({ where: { id, deletedAt: null, ...dealScope(ctx) } })
  if (!deal) notFound('Заявка')
  return deal
}
