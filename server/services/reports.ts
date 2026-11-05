import type { Pipeline } from '../generated/prisma/client'
import { CHANNEL_LABELS, LOST_REASONS } from '#shared/domain/types'
import { formatRange } from '#shared/utils/dates'
import type { ScopedDb } from '../utils/db'
import { departureParticipants } from './departures'
import { loadStages } from './deals'

import { periodRange, type Period } from '#shared/domain/periods'

export { periodRange, type Period }

/** All report data for the selected filters (docs/02_FEATURES.md §14). */
export async function buildReport(db: ScopedDb, opts: { period: Period, pipeline?: Pipeline | null, managerId?: string | null }) {
  const { from, to, label } = periodRange(opts.period)
  const inPeriod = (d: Date | null | undefined) => !!d && (!from || d >= from) && d <= to
  const dealWhere = { deletedAt: null, ...(opts.pipeline ? { pipeline: opts.pipeline } : {}), ...(opts.managerId ? { managerId: opts.managerId } : {}) }

  const [deals, members, conversations, overdue, departures] = await Promise.all([
    db.deal.findMany({
      where: dealWhere,
      include: { stage: { select: { order: true, pipeline: true } }, payments: true, offers: { where: { status: 'CHOSEN' } }, bookings: { include: { payments: true, operator: { select: { name: true } } } }, client: { select: { name: true } } },
    }),
    db.member.findMany({ include: { user: { select: { name: true } } } }),
    db.conversation.count({ where: from ? { lastMessageAt: { gte: from } } : {} }),
    db.task.groupBy({ by: ['assigneeId'], where: { status: { not: 'DONE' }, dueAt: { lt: new Date() } }, _count: true }),
    db.departure.findMany({ where: from ? { startDate: { gte: from } } : {}, orderBy: { startDate: 'asc' } }),
  ])
  const name = (id: string | null) => members.find(m => m.id === id)?.user.name ?? 'Без ответственного'
  const paidOf = (d: (typeof deals)[number]) => d.payments.reduce((s, p) => s + p.amount, 0)

  const created = deals.filter(d => inPeriod(d.createdAt))
  const won = deals.filter(d => inPeriod(d.wonAt))
  const lost = deals.filter(d => inPeriod(d.lostAt))
  const payments = deals.flatMap(d => d.payments.filter(p => inPeriod(p.paidAt)))
  const income = payments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const refunds = -payments.filter(p => p.amount < 0).reduce((s, p) => s + p.amount, 0)
  const active = deals.filter(d => !d.wonAt && !d.lostAt)
  const receivable = active.reduce((s, d) => s + Math.max(0, d.price - paidOf(d)), 0)
  const commission = deals.filter(d => d.pipeline === 'PACKAGE' && (inPeriod(d.createdAt) || inPeriod(d.wonAt))).flatMap(d => d.offers).reduce((s, o) => s + (o.price - o.net), 0)

  const kpis = {
    leads: Math.max(created.length, conversations),
    sales: won.length,
    conversion: created.length ? Math.round((won.length / created.length) * 100) : 0,
    income,
    avgCheck: won.length ? Math.round(won.reduce((s, d) => s + d.price, 0) / won.length) : 0,
    commission,
    receivable,
    refunds,
    lost: lost.length,
  }

  // Sources and managers
  const sources = Object.entries(created.reduce<Record<string, { leads: number, won: number, revenue: number }>>((acc, d) => {
    const k = CHANNEL_LABELS[d.source]
    acc[k] ??= { leads: 0, won: 0, revenue: 0 }
    acc[k].leads++
    if (d.wonAt) {
      acc[k].won++
      acc[k].revenue += d.price
    }
    return acc
  }, {})).map(([source, v]) => ({ source, ...v, conversion: v.leads ? Math.round((v.won / v.leads) * 100) : 0 })).sort((a, b) => b.leads - a.leads)

  const managerIds = [...new Set(deals.map(d => d.managerId))]
  const managers = managerIds.map((id) => {
    const mine = deals.filter(d => d.managerId === id)
    const c = mine.filter(d => inPeriod(d.createdAt))
    const w = mine.filter(d => inPeriod(d.wonAt))
    return {
      manager: name(id), leads: c.length, active: mine.filter(d => !d.wonAt && !d.lostAt).length, won: w.length, revenue: w.reduce((s, d) => s + d.price, 0),
      income: mine.flatMap(d => d.payments.filter(p => inPeriod(p.paidAt) && p.amount > 0)).reduce((s, p) => s + p.amount, 0),
      conversion: c.length ? Math.round((w.length / c.length) * 100) : 0, overdue: overdue.find(o => o.assigneeId === id)?._count ?? 0,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // Funnel per pipeline: how many deals created in the period reached each stage
  const pipelines: Pipeline[] = opts.pipeline ? [opts.pipeline] : ['GROUP', 'PACKAGE', 'BASE']
  const funnel = []
  for (const p of pipelines) {
    const stages = await loadStages(db, p)
    const ds = created.filter(d => d.pipeline === p)
    funnel.push({
      pipeline: p,
      total: ds.length,
      stages: stages.map(s => ({ name: s.name, reached: ds.filter(d => d.wonAt || d.stage.order >= s.order).length })),
      won: ds.filter(d => d.wonAt).length,
    })
  }

  // Departures
  const parts = await departureParticipants(db, departures.map(d => d.id))
  const deps = departures.map((d) => {
    const p = parts[d.id] ?? []
    return { name: d.name, dates: formatRange(d.startDate, d.endDate), seats: d.maxSeats, sold: p.length, ready: p.filter(x => x.ready).length, fill: Math.round((p.length / d.maxSeats) * 100), gross: p.length * d.price }
  })

  // Debts
  const receivables = active.map(d => ({ number: d.number, client: d.client.name, price: d.price, paid: paidOf(d), debt: d.price - paidOf(d), deadline: d.fullPayDeadline, manager: name(d.managerId) })).filter(x => x.debt > 0).sort((a, b) => b.debt - a.debt)
  const payables = deals.flatMap(d => d.bookings.filter(b => b.status === 'REQUEST' || b.status === 'CONFIRMED').map(b => ({ number: d.number, client: d.client.name, operator: b.operator.name, bookingNo: b.number, net: b.net, paid: b.payments.reduce((s, x) => s + x.amount, 0), deadline: b.paymentDeadline }))).map(x => ({ ...x, debt: x.net - x.paid })).filter(x => x.debt > 0)

  // Lost reasons
  const reasons = [...LOST_REASONS].map(r => ({ reason: r, count: lost.filter(d => d.lostReason === r).length, sum: lost.filter(d => d.lostReason === r).reduce((s, d) => s + d.price, 0) })).filter(r => r.count)

  return { label, kpis, sources, managers, funnel, departures: deps, receivables, payables, reasons }
}
export type Report = Awaited<ReturnType<typeof buildReport>>
