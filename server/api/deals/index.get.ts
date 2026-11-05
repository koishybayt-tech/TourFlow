import { z } from 'zod'
import { stageProgress } from '#shared/domain/dealStatus'
import { can } from '#shared/permissions'
import { dealSnapshot, loadStages } from '../../services/deals'

/** Deals for kanban and list (docs/02_FEATURES.md §4). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const q = queryOf(event, z.object({
    pipeline: z.enum(['GROUP', 'PACKAGE', 'BASE']).default('GROUP'),
    manager: z.string().optional(),
    status: z.enum(['active', 'won', 'lost', 'all']).default('active'),
    q: z.string().optional(),
  }))
  const showMoney = can(ctx.role, 'payments')
  const where: Record<string, unknown> = { deletedAt: null, pipeline: q.pipeline, ...dealScope(ctx) }
  if (q.manager && !dealScope(ctx).managerId) where.managerId = q.manager === 'none' ? null : q.manager
  if (q.status === 'active') Object.assign(where, { wonAt: null, lostAt: null })
  if (q.status === 'won') where.wonAt = { not: null }
  if (q.status === 'lost') where.lostAt = { not: null }
  if (q.q?.trim()) where.OR = [{ title: { contains: q.q.trim(), mode: 'insensitive' } }, { client: { name: { contains: q.q.trim(), mode: 'insensitive' } } }]

  const [stages, deals] = await Promise.all([
    loadStages(ctx.db, q.pipeline),
    ctx.db.deal.findMany({
      where,
      include: { client: { select: { name: true, phone: true } }, manager: { include: { user: { select: { name: true } } } }, payments: { select: { amount: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const rows = await Promise.all(deals.map(async (d) => {
    const stage = stages.find(s => s.id === d.stageId)
    let done = 0
    let total = 0
    if (stage && !d.wonAt && !d.lostAt) {
      const { forStage } = await dealSnapshot(ctx.db, d.id)
      const p = stageProgress(stage, forStage(stage.id))
      done = p.doneCount
      total = p.totalCount
    }
    const paid = d.payments.reduce((s, p) => s + p.amount, 0)
    return {
      id: d.id, number: d.number, client: d.client.name, phone: d.client.phone, title: d.title, source: d.source, people: d.people, dates: d.dates,
      stageId: d.stageId, stage: stage?.name ?? '', stageOrder: stage?.order ?? 0, managerId: d.managerId, manager: d.manager?.user.name ?? null,
      price: showMoney ? d.price : null, paid: showMoney ? paid : null, paidPct: showMoney && d.price ? Math.min(100, Math.round((paid / d.price) * 100)) : null,
      createdAt: d.createdAt, updatedAt: d.updatedAt, wonAt: d.wonAt, lostAt: d.lostAt, lostReason: d.lostReason, done, total,
    }
  }))
  return {
    stages: stages.map(s => {
      const inStage = rows.filter(r => r.stageId === s.id && !r.wonAt && !r.lostAt)
      return { id: s.id, name: s.name, order: s.order, count: inStage.length, sum: showMoney ? inStage.reduce((a, r) => a + (r.price ?? 0), 0) : null, requirements: s.requirements.filter(r => r.required).length }
    }),
    deals: rows,
  }
})
