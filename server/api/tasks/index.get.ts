import { z } from 'zod'
import { startOfAlmatyDay } from '#shared/utils/dates'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tasks')
  const q = queryOf(event, z.object({
    quick: z.enum(['all', 'mine', 'today', 'overdue']).default('all'),
    q: z.string().optional(),
    assignee: z.string().optional(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    link: z.enum(['all', 'deal', 'departure', 'none']).default('all'),
    hideDone: z.enum(['true', 'false']).default('true'),
  }))
  const today = startOfAlmatyDay()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const where: Record<string, unknown> = {}
  // Managers see their own tasks and tasks of their deals.
  if (ctx.role !== 'OWNER') where.OR = [{ assigneeId: ctx.memberId }, { authorId: ctx.memberId }, { deal: { managerId: ctx.memberId } }]
  if (q.quick === 'mine') where.assigneeId = ctx.memberId
  if (q.quick === 'today') Object.assign(where, { dueAt: { lt: tomorrow }, status: { not: 'DONE' } })
  if (q.quick === 'overdue') Object.assign(where, { dueAt: { lt: today }, status: { not: 'DONE' } })
  if (q.assignee) where.assigneeId = q.assignee === 'none' ? null : q.assignee
  if (q.priority) where.priority = q.priority
  if (q.link === 'deal') where.dealId = { not: null }
  if (q.link === 'departure') where.departureId = { not: null }
  if (q.link === 'none') Object.assign(where, { dealId: null, departureId: null })
  if (q.hideDone === 'true' && q.quick !== 'today' && q.quick !== 'overdue') where.status = { not: 'DONE' }
  if (q.q?.trim()) where.title = { contains: q.q.trim(), mode: 'insensitive' }
  const tasks = await ctx.db.task.findMany({
    where: { AND: [where, { OR: [{ dealId: null }, { deal: { deletedAt: null } }] }] },
    include: {
      assignee: { include: { user: { select: { name: true } } } },
      author: { include: { user: { select: { name: true } } } },
      deal: { select: { id: true, number: true, title: true, client: { select: { name: true } } } },
      departure: { select: { id: true, name: true } },
      stage: { select: { name: true } },
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  })
  return tasks.map(t => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority, dueAt: t.dueAt, isSystem: t.isSystem, result: t.result,
    assigneeId: t.assigneeId, assignee: t.assignee?.user.name ?? null, author: t.author?.user.name ?? (t.authorId ? null : 'Система'),
    deal: t.deal ? { id: t.deal.id, number: t.deal.number, title: t.deal.title, client: t.deal.client.name } : null,
    departure: t.departure, stage: t.stage?.name ?? null,
    subtasks: t.subtasks as { t: string, done: boolean }[],
  }))
})
